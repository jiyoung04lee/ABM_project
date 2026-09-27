"""
0단계 데이터 수집 정비 테스트.

- 모든 이벤트에 방문 단위 세션 ID(X-Session-Id)와 방문자 유형이 붙는지
- 프론트 전용 행동 이벤트(로그인 요구 화면·글쓰기 시작·네트워크 검색) 저장
- 페이지뷰의 유입 정보 저장
- 비로그인 users/me 401이 에러로 집계되지 않는지
- 분석 전용 뷰(sync_analytics_views)의 SELECT가 현재 스키마와 맞는지
"""
import itertools
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from django.test import TestCase
from django.utils import timezone
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.tokens import AccessToken

from .management.commands.sync_analytics_views import VIEWS
from .models import ApiErrorLog, DailyActiveUser, EventLog, EventSetting
from .utils import (
    DORMANT_DAYS,
    NEW_MEMBER_DAYS,
    analytics_today,
    clean_properties,
    clean_referrer_host,
    resolve_visitor_type,
)

User = get_user_model()

_seq = itertools.count(1)

TRACK_URL = "/api/logs/track/"
PAGE_VIEW_URL = "/api/logs/page-view/"


def make_user(**extra):
    n = next(_seq)
    extra.setdefault("nickname", f"collector{n}")
    extra.setdefault("user_type", "student")
    extra.setdefault("grade", 2)
    extra.setdefault("is_profile_complete", True)
    return User.objects.create_user(
        email=f"collector{n}@kookmin.ac.kr",
        password="pw-test-1234",
        **extra,
    )


def backdate_join(user, days):
    """created_at은 auto_now_add라 update로 과거 가입일을 만든다."""
    User.objects.filter(pk=user.pk).update(
        created_at=timezone.now() - timedelta(days=days)
    )
    user.refresh_from_db()


class JwtClientMixin:
    def authenticate(self, user):
        self.client.cookies["access_token"] = str(AccessToken.for_user(user))


class NewEventSettingsTests(TestCase):
    def test_new_event_types_are_active(self):
        active = set(
            EventSetting.objects.filter(
                event_type__in=["login_wall_view", "write_start", "draft_save"],
                is_active=True,
            ).values_list("event_type", flat=True)
        )
        self.assertEqual(active, {"login_wall_view", "write_start", "draft_save"})


class VisitorTypeTests(TestCase):
    def setUp(self):
        cache.clear()
        self.today = analytics_today()

    def test_guest(self):
        from django.contrib.auth.models import AnonymousUser

        self.assertEqual(resolve_visitor_type(None), "guest")
        self.assertEqual(resolve_visitor_type(AnonymousUser()), "guest")

    def test_new_member_within_days(self):
        user = make_user()
        backdate_join(user, NEW_MEMBER_DAYS - 1)
        self.assertEqual(resolve_visitor_type(user), "new")

    def test_member_recently_active(self):
        user = make_user()
        backdate_join(user, 100)
        DailyActiveUser.objects.create(user=user, date=self.today - timedelta(days=3))
        self.assertEqual(resolve_visitor_type(user), "member")

    def test_returning_after_dormant_period(self):
        user = make_user()
        backdate_join(user, 100)
        DailyActiveUser.objects.create(
            user=user, date=self.today - timedelta(days=DORMANT_DAYS)
        )
        self.assertEqual(resolve_visitor_type(user), "returning")

    def test_today_activity_is_not_previous_activity(self):
        """오늘 방문 기록은 '직전 활동'으로 보지 않는다."""
        user = make_user()
        backdate_join(user, 100)
        DailyActiveUser.objects.create(
            user=user, date=self.today - timedelta(days=DORMANT_DAYS + 5)
        )
        DailyActiveUser.objects.create(user=user, date=self.today)
        self.assertEqual(resolve_visitor_type(user), "returning")

    def test_falls_back_to_login_point_date(self):
        """DAU 수집 전 가입자는 로그인 점수 지급일로 판단한다."""
        user = make_user()
        backdate_join(user, 200)
        User.objects.filter(pk=user.pk).update(
            last_login_point_date=self.today - timedelta(days=DORMANT_DAYS + 10)
        )
        user.refresh_from_db()
        self.assertEqual(resolve_visitor_type(user), "returning")

    def test_no_history_is_member(self):
        user = make_user()
        backdate_join(user, 200)
        self.assertEqual(resolve_visitor_type(user), "member")

    def test_onboarding_in_progress_is_new(self):
        """카카오 로그인만 하고 온보딩 전인 사용자는 가입 진행 중 = new."""
        user = make_user(is_profile_complete=False)
        backdate_join(user, 100)
        User.objects.filter(pk=user.pk).update(
            last_login_point_date=self.today - timedelta(days=DORMANT_DAYS + 10)
        )
        user.refresh_from_db()
        self.assertEqual(resolve_visitor_type(user), "new")

    def test_late_onboarding_counts_from_completion(self):
        """계정은 오래됐어도 온보딩을 오늘 마쳤으면 new."""
        user = make_user()
        backdate_join(user, 100)
        User.objects.filter(pk=user.pk).update(
            profile_completed_at=timezone.now(),
            last_login_point_date=self.today - timedelta(days=DORMANT_DAYS + 10),
        )
        user.refresh_from_db()
        self.assertEqual(resolve_visitor_type(user), "new")

    def test_forget_visitor_type_recomputes(self):
        from .utils import forget_visitor_type

        user = make_user()
        backdate_join(user, 100)
        self.assertEqual(resolve_visitor_type(user), "member")
        User.objects.filter(pk=user.pk).update(profile_completed_at=timezone.now())
        user.refresh_from_db()
        self.assertEqual(resolve_visitor_type(user), "member")  # 캐시
        forget_visitor_type(user)
        self.assertEqual(resolve_visitor_type(user), "new")

    def test_result_is_fixed_for_the_day(self):
        user = make_user()
        backdate_join(user, 100)
        DailyActiveUser.objects.create(
            user=user, date=self.today - timedelta(days=DORMANT_DAYS + 1)
        )
        self.assertEqual(resolve_visitor_type(user), "returning")
        DailyActiveUser.objects.create(user=user, date=self.today - timedelta(days=1))
        self.assertEqual(resolve_visitor_type(user), "returning")


class CleanHelperTests(TestCase):
    def test_properties_keep_short_scalars_only(self):
        cleaned = clean_properties(
            {
                "reason": "detail",
                "count": 3,
                "flag": True,
                "nested": {"a": 1},
                "items": [1, 2],
                "long": "x" * 500,
                "": "empty-key",
                "blank": "   ",
            }
        )
        self.assertEqual(cleaned["reason"], "detail")
        self.assertEqual(cleaned["count"], 3)
        self.assertIs(cleaned["flag"], True)
        self.assertEqual(len(cleaned["long"]), 100)
        for key in ("nested", "items", "", "blank"):
            self.assertNotIn(key, cleaned)

    def test_properties_limit_keys(self):
        cleaned = clean_properties({f"k{i}": "v" for i in range(30)})
        self.assertEqual(len(cleaned), 10)

    def test_non_dict_properties(self):
        self.assertEqual(clean_properties(None), {})
        self.assertEqual(clean_properties(["a"]), {})

    def test_referrer_host(self):
        self.assertEqual(clean_referrer_host("L.Instagram.com"), "l.instagram.com")
        self.assertEqual(clean_referrer_host("https://evil.com/path"), "")
        self.assertEqual(clean_referrer_host("<script>"), "")
        self.assertEqual(clean_referrer_host(None), "")


class SessionIdPropagationTests(JwtClientMixin, TestCase):
    def setUp(self):
        cache.clear()

    def test_header_session_id_attached_to_event(self):
        self.client.post(
            TRACK_URL,
            {"event_type": "search", "keyword": "교환학생"},
            content_type="application/json",
            HTTP_X_SESSION_ID="s_1727000000_abc123",
        )
        log = EventLog.objects.get(event_type="search")
        self.assertEqual(log.session_id, "s_1727000000_abc123")
        self.assertEqual(log.visitor_type, "guest")

    def test_invalid_session_id_ignored(self):
        self.client.post(
            TRACK_URL,
            {"event_type": "search", "keyword": "교환학생"},
            content_type="application/json",
            HTTP_X_SESSION_ID="bad id; drop table",
        )
        self.assertIsNone(EventLog.objects.get(event_type="search").session_id)

    def test_session_id_attached_to_server_side_event(self):
        """기존 서버 이벤트(글 목록 검색)에도 헤더 세션 ID가 붙는다."""
        user = make_user()
        self.authenticate(user)
        self.client.get(
            "/api/community/posts/?search=인턴",
            HTTP_X_SESSION_ID="s_1727000000_srv",
        )
        log = EventLog.objects.get(event_type="search", section="community")
        self.assertEqual(log.session_id, "s_1727000000_srv")
        self.assertIn(log.visitor_type, ("new", "member"))

    def test_session_id_does_not_leak_between_requests(self):
        self.client.post(
            TRACK_URL,
            {"event_type": "search", "keyword": "첫요청"},
            content_type="application/json",
            HTTP_X_SESSION_ID="s_first",
        )
        self.client.post(
            TRACK_URL,
            {"event_type": "search", "keyword": "둘째요청"},
            content_type="application/json",
        )
        second = EventLog.objects.get(search_keyword="둘째요청")
        self.assertIsNone(second.session_id)


class TrackEventViewTests(JwtClientMixin, TestCase):
    def setUp(self):
        cache.clear()

    def post(self, payload, **extra):
        return self.client.post(
            TRACK_URL, payload, content_type="application/json", **extra
        )

    def test_rejects_unknown_event_type(self):
        self.assertEqual(self.post({"event_type": "like"}).status_code, 400)
        self.assertEqual(self.post({}).status_code, 400)
        self.assertFalse(EventLog.objects.exists())

    def test_login_wall_view_with_reason(self):
        res = self.post(
            {"event_type": "login_wall_view", "from": "network", "reason": "detail"}
        )
        self.assertEqual(res.status_code, 201)
        log = EventLog.objects.get(event_type="login_wall_view")
        self.assertEqual(log.section, "network")
        self.assertEqual(log.properties, {"from": "network", "reason": "detail"})

    def test_login_wall_view_direct(self):
        self.post({"event_type": "login_wall_view"})
        log = EventLog.objects.get(event_type="login_wall_view")
        self.assertIsNone(log.section)
        self.assertEqual(log.properties, {"reason": "direct"})

    def test_login_wall_view_sanitizes_values(self):
        self.post(
            {"event_type": "login_wall_view", "from": "<b>x</b>", "reason": "a" * 200}
        )
        log = EventLog.objects.get(event_type="login_wall_view")
        self.assertEqual(log.properties, {"reason": "direct"})

    def test_write_start(self):
        user = make_user()
        self.authenticate(user)
        res = self.post(
            {"event_type": "write_start", "section": "network", "post_type": "graduate"}
        )
        self.assertEqual(res.status_code, 201)
        log = EventLog.objects.get(event_type="write_start")
        self.assertEqual(log.section, "network")
        self.assertEqual(log.properties, {"post_type": "graduate"})
        self.assertEqual(log.grade_at_event, 2)

    def test_write_start_requires_valid_section(self):
        self.assertEqual(
            self.post({"event_type": "write_start", "section": "admin"}).status_code,
            400,
        )

    def test_network_search(self):
        user = make_user(interests=["ai"])
        self.authenticate(user)
        self.post({"event_type": "search", "keyword": "  교환학생  "})
        log = EventLog.objects.get(event_type="search")
        self.assertEqual(log.section, "network")
        self.assertEqual(log.search_keyword, "교환학생")
        self.assertEqual(log.interest_at_event, "ai")

    def test_search_requires_two_chars(self):
        self.assertEqual(
            self.post({"event_type": "search", "keyword": "a"}).status_code, 400
        )

    def test_search_keyword_control_chars_removed(self):
        """NUL 등 제어문자는 PostgreSQL 저장 오류를 내므로 제거한다."""
        self.post({"event_type": "search", "keyword": "교환\x00학생\n"})
        self.assertEqual(
            EventLog.objects.get(event_type="search").search_keyword, "교환학생"
        )

    def test_non_object_body_is_400(self):
        for body in ("[1, 2]", '"text"', "3"):
            with self.subTest(body=body):
                res = self.client.post(TRACK_URL, body, content_type="application/json")
                self.assertEqual(res.status_code, 400)
                res = self.client.post(PAGE_VIEW_URL, body, content_type="application/json")
                self.assertEqual(res.status_code, 400)

    def test_staff_events_not_recorded(self):
        self.authenticate(make_user(is_staff=True))
        self.post({"event_type": "search", "keyword": "운영자"})
        self.assertFalse(EventLog.objects.exists())

    def test_throttled(self):
        with patch.dict(ScopedRateThrottle.THROTTLE_RATES, {"event_track": "2/min"}):
            codes = [
                self.post({"event_type": "login_wall_view"}).status_code
                for _ in range(3)
            ]
        self.assertEqual(codes, [201, 201, 429])


class PageViewAttributionTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_stores_session_utm_and_referrer(self):
        self.client.post(
            PAGE_VIEW_URL,
            {
                "section": "network",
                "page": "/network/12",
                "session_id": "s_1_abc",
                "utm_source": "ig",
                "referrer_host": "l.instagram.com",
            },
            content_type="application/json",
        )
        log = EventLog.objects.get(event_type="page_view")
        self.assertEqual(log.utm_source, "ig")
        self.assertEqual(log.properties, {"referrer_host": "l.instagram.com"})
        self.assertEqual(log.session_id, "s_1_abc")
        self.assertEqual(log.visitor_type, "guest")

    def test_invalid_referrer_dropped(self):
        self.client.post(
            PAGE_VIEW_URL,
            {"section": "home", "session_id": "s_2", "referrer_host": "http://x.com/a"},
            content_type="application/json",
        )
        self.assertEqual(EventLog.objects.get().properties, {})

    def test_long_utm_truncated(self):
        self.client.post(
            PAGE_VIEW_URL,
            {"section": "home", "session_id": "s_3", "utm_source": "u" * 200},
            content_type="application/json",
        )
        self.assertEqual(len(EventLog.objects.get().utm_source), 50)


class DraftSaveEventTests(JwtClientMixin, TestCase):
    def setUp(self):
        cache.clear()
        self.user = make_user()
        self.authenticate(self.user)

    def save_draft(self, post_type="student"):
        return self.client.post(
            "/api/networks/drafts/",
            {"type": post_type, "title": "제목", "content": "<p>내용</p>", "image_ids": []},
            content_type="application/json",
        )

    def test_first_save_logged_once_per_day_and_type(self):
        for _ in range(3):
            self.assertEqual(self.save_draft().status_code, 200)
        self.save_draft("graduate")
        logs = EventLog.objects.filter(event_type="draft_save")
        self.assertEqual(logs.count(), 2)
        self.assertEqual(
            sorted(log.properties["post_type"] for log in logs),
            ["graduate", "student"],
        )


class ErrorLogExclusionTests(TestCase):
    def test_guest_me_401_not_logged(self):
        res = self.client.get("/api/users/me/")
        self.assertEqual(res.status_code, 401)
        self.assertFalse(ApiErrorLog.objects.exists())

    def test_other_401_still_logged(self):
        res = self.client.get("/api/notifications/")
        self.assertEqual(res.status_code, 401)
        self.assertTrue(
            ApiErrorLog.objects.filter(path="/api/notifications/", status_code=401).exists()
        )


class AnalyticsViewSqlTests(TestCase):
    """
    분석 뷰의 SELECT가 현재 테이블·컬럼과 맞는지 확인.
    (운영은 PostgreSQL이지만 컬럼 이름 검증은 테스트 DB에서도 충분하다.)
    모델에서 컬럼을 지우거나 이름을 바꾸면 여기서 먼저 실패한다.
    """

    def test_every_view_select_runs(self):
        with connection.cursor() as cursor:
            for name, select_sql in VIEWS.items():
                sql = select_sql.replace("public.", "")
                if connection.vendor != "postgresql":
                    # 테스트 DB(SQLite)는 AT TIME ZONE을 모른다 — 컬럼 존재 여부만 확인
                    sql = sql.replace(" AT TIME ZONE 'Asia/Seoul'", "")
                with self.subTest(view=name):
                    cursor.execute(sql + " LIMIT 1")

    def test_session_hidden_for_write_events(self):
        """글 작성·댓글·좋아요·임시저장 이벤트는 세션으로 익명 작성자를 추적할 수 없게 한다."""
        sql = VIEWS["event_log"]
        for event_type in ("post_create", "comment", "like", "draft_save"):
            self.assertIn(f"'{event_type}'", sql)
        self.assertIn("THEN NULL", sql)

    def test_user_linked_times_are_dates_only(self):
        for name in (
            "users", "community_reaction", "community_comment_reaction",
            "network_reaction", "network_comment_reaction", "network_draft",
        ):
            with self.subTest(view=name):
                columns = self._selected_columns(VIEWS[name])
                for exact in ("created_at", "last_login", "updated_at", "profile_completed_at"):
                    self.assertNotIn(exact, columns)

    @staticmethod
    def _selected_columns(select_sql):
        select_part = select_sql.split("FROM")[0].replace("SELECT", "")
        return {
            part.strip().split()[-1].strip('"').lower()
            for part in select_part.split(",")
            if part.strip()
        }

    def test_users_view_has_no_personal_columns(self):
        columns = self._selected_columns(VIEWS["users"])
        for column in (
            "name", "email", "email_encrypted", "email_hash", "student_id",
            "student_id_encrypted", "student_id_hash", "kakao_id", "password",
            "nickname", "bio", "profile_image", "multi_major_image", "department",
        ):
            with self.subTest(column=column):
                self.assertNotIn(column, columns)

    def test_no_view_exposes_bodies(self):
        for name, select_sql in VIEWS.items():
            with self.subTest(view=name):
                self.assertNotIn("content", self._selected_columns(select_sql))
        self.assertNotIn("title", self._selected_columns(VIEWS["network_draft"]))

    def test_anonymous_authors_masked(self):
        for name in ("community_post", "community_comment", "network_post", "network_comment"):
            with self.subTest(view=name):
                self.assertIn(
                    "CASE WHEN is_anonymous THEN NULL ELSE author_id END",
                    VIEWS[name],
                )

    def test_command_is_noop_outside_postgres(self):
        from io import StringIO

        from django.core.management import call_command

        out = StringIO()
        call_command("sync_analytics_views", stdout=out)
        if connection.vendor != "postgresql":
            self.assertIn("건너뜁니다", out.getvalue())
