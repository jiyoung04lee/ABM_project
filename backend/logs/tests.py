"""
DailyActiveUser 수집(미들웨어), 활성 사용자 지표, 비활성 회원 복귀 분석 테스트.

날짜 경계는 프로젝트 전체가 Asia/Seoul로 통일되어 있으며,
EventLog의 created_at__date 분류까지 같은 기준인지 함께 검증한다.
"""
import itertools
from datetime import datetime, timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from rest_framework_simplejwt.tokens import AccessToken

from .models import DailyActiveUser
from .utils import analytics_today, record_daily_active_user

User = get_user_model()
KST = ZoneInfo("Asia/Seoul")

_seq = itertools.count(1)


def make_user(email=None, **extra):
    """nickname이 unique이므로 매번 새 값을 부여한다."""
    n = next(_seq)
    extra.setdefault("nickname", f"tester{n}")
    extra.setdefault("user_type", "student")
    extra.setdefault("grade", 3)
    return User.objects.create_user(
        email=email or f"user{n}@kookmin.ac.kr",
        password="pw-test-1234",
        **extra,
    )


class JwtClientMixin:
    """
    DRF 인증 클래스가 PendingAwareJWTAuthentication 하나뿐이라
    Django 세션 로그인(force_login)으로는 인증되지 않는다.
    실제 경로와 동일하게 access_token 쿠키로 인증한다.
    """

    def authenticate(self, user):
        self.client.cookies["access_token"] = str(AccessToken.for_user(user))

    def logout_jwt(self):
        self.client.cookies.pop("access_token", None)


class AnalyticsTodayTests(TestCase):
    """날짜 경계가 프로젝트 전체에서 한국 시간으로 통일되어 있는지."""

    def test_uses_kst_not_utc(self):
        # UTC 2026-09-17 18:00 == KST 2026-09-18 03:00
        instant = datetime(2026, 9, 17, 18, 0, tzinfo=ZoneInfo("UTC"))
        with patch.object(timezone, "now", return_value=instant):
            self.assertEqual(analytics_today().isoformat(), "2026-09-18")

    def test_project_timezone_is_seoul(self):
        self.assertEqual(settings.TIME_ZONE, "Asia/Seoul")

    def test_localdate_agrees_with_analytics_today(self):
        """TIME_ZONE 통일 후에는 Django 기본 날짜와 분석 날짜가 일치해야 한다."""
        instant = datetime(2026, 9, 17, 18, 0, tzinfo=ZoneInfo("UTC"))
        with patch.object(timezone, "now", return_value=instant):
            self.assertEqual(timezone.localdate(instant), analytics_today())

    def test_eventlog_date_lookup_uses_kst(self):
        """EventLog의 created_at__date도 KST 기준으로 분류되어야 한다."""
        from .models import EventLog

        log = EventLog.objects.create(event_type="page_view", section="home")
        # KST 2026-09-18 03:00 에 발생 (UTC로는 전날 18:00)
        EventLog.objects.filter(pk=log.pk).update(
            created_at=datetime(2026, 9, 17, 18, 0, tzinfo=ZoneInfo("UTC"))
        )
        self.assertTrue(
            EventLog.objects.filter(pk=log.pk, created_at__date="2026-09-18").exists()
        )
        self.assertFalse(
            EventLog.objects.filter(pk=log.pk, created_at__date="2026-09-17").exists()
        )


class RecordDailyActiveUserTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = make_user("member@kookmin.ac.kr")

    def test_records_one_row(self):
        record_daily_active_user(self.user)
        self.assertEqual(DailyActiveUser.objects.count(), 1)
        row = DailyActiveUser.objects.get()
        self.assertEqual(row.user_id, self.user.pk)
        self.assertEqual(row.date, analytics_today())

    def test_repeated_calls_create_only_one_row(self):
        for _ in range(5):
            record_daily_active_user(self.user)
        self.assertEqual(DailyActiveUser.objects.count(), 1)

    def test_repeated_calls_without_cache_still_one_row(self):
        """캐시가 빗나가도 get_or_create + UniqueConstraint가 막아야 한다."""
        for _ in range(5):
            cache.clear()
            record_daily_active_user(self.user)
        self.assertEqual(DailyActiveUser.objects.count(), 1)

    def test_db_constraint_blocks_duplicate(self):
        record_daily_active_user(self.user)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                DailyActiveUser.objects.create(
                    user=self.user, date=analytics_today()
                )

    def test_staff_excluded(self):
        staff = make_user("staff@kookmin.ac.kr", is_staff=True)
        record_daily_active_user(staff)
        self.assertEqual(DailyActiveUser.objects.count(), 0)

    def test_anonymous_and_none_excluded(self):
        from django.contrib.auth.models import AnonymousUser

        record_daily_active_user(None)
        record_daily_active_user(AnonymousUser())
        self.assertEqual(DailyActiveUser.objects.count(), 0)


class MiddlewareTests(JwtClientMixin, TestCase):
    """인증된 API 요청이 방문으로 기록되는지."""

    def setUp(self):
        cache.clear()
        self.user = make_user("visitor@kookmin.ac.kr")

    def test_authenticated_api_request_records_visit(self):
        self.authenticate(self.user)
        self.client.get("/api/users/me/")
        self.assertEqual(
            DailyActiveUser.objects.filter(user=self.user).count(), 1
        )

    def test_any_authenticated_endpoint_counts_not_just_login(self):
        """login 이벤트와 무관하게, 아무 인증 요청이면 방문으로 잡힌다."""
        self.authenticate(self.user)
        self.client.get("/api/users/me/posts/")
        self.assertEqual(DailyActiveUser.objects.count(), 1)

    def test_repeated_requests_create_one_row(self):
        self.authenticate(self.user)
        for _ in range(10):
            self.client.get("/api/users/me/")
        self.assertEqual(DailyActiveUser.objects.count(), 1)

    def test_anonymous_api_request_records_nothing(self):
        self.client.get("/api/users/me/")
        self.assertEqual(DailyActiveUser.objects.count(), 0)

    def test_staff_api_request_records_nothing(self):
        self.authenticate(make_user("staff2@kookmin.ac.kr", is_staff=True))
        self.client.get("/api/users/me/")
        self.assertEqual(DailyActiveUser.objects.count(), 0)

    def test_non_api_path_records_nothing(self):
        self.authenticate(self.user)
        self.client.get("/")
        self.assertEqual(DailyActiveUser.objects.count(), 0)


class ActiveUserStatsViewTests(JwtClientMixin, TestCase):
    """지표 계산 및 데이터 부족 상태(pending/partial)."""

    def setUp(self):
        cache.clear()
        self.url = reverse("logs:active-users")
        self.admin = make_user("admin@kookmin.ac.kr", is_staff=True)
        self.authenticate(self.admin)
        self.today = analytics_today()

    def seed(self, user, *offsets):
        """offsets: 오늘로부터 며칠 전인지."""
        for off in offsets:
            DailyActiveUser.objects.create(
                user=user, date=self.today - timedelta(days=off)
            )

    def test_requires_admin(self):
        self.authenticate(make_user("normal@kookmin.ac.kr"))
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_requires_authentication(self):
        self.logout_jwt()
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_empty_state_is_pending_not_zero(self):
        body = self.client.get(self.url).json()
        self.assertIsNone(body["tracking_since"])
        self.assertEqual(body["dau"], 0)
        self.assertEqual(body["returning_user_rate"]["status"], "pending")
        self.assertIsNone(body["returning_user_rate"]["rate"])
        self.assertEqual(body["weekly_retention"]["status"], "pending")
        self.assertIsNone(body["weekly_retention"]["rate"])

    def test_first_day_returning_rate_is_pending(self):
        """첫날엔 '이전 기록'이 없어 0%가 아니라 집계 중이어야 한다."""
        self.seed(make_user("a@kookmin.ac.kr"), 0)
        self.seed(make_user("b@kookmin.ac.kr"), 0)

        body = self.client.get(self.url).json()
        self.assertEqual(body["dau"], 2)
        self.assertEqual(body["tracking_since"], self.today.isoformat())
        self.assertEqual(body["tracking_days"], 1)
        self.assertEqual(body["returning_user_rate"]["status"], "pending")
        self.assertIsNone(body["returning_user_rate"]["rate"])
        self.assertEqual(body["returning_user_rate"]["active_users"], 2)
        # WAU는 값은 있되 누적 범위가 짧다는 것이 드러나야 한다
        self.assertEqual(body["wau"]["value"], 2)
        self.assertEqual(body["wau"]["status"], "partial")
        self.assertEqual(body["wau"]["days_covered"], 1)
        self.assertEqual(body["wau"]["days_expected"], 7)

    def test_returning_rate_with_history(self):
        returning_user = make_user("r@kookmin.ac.kr")
        self.seed(returning_user, 1, 0)          # 어제 + 오늘
        self.seed(make_user("n@kookmin.ac.kr"), 0)  # 오늘만 (신규)

        rate = self.client.get(self.url).json()["returning_user_rate"]
        self.assertEqual(rate["status"], "ready")
        self.assertEqual(rate["active_users"], 2)
        self.assertEqual(rate["returning_users"], 1)
        self.assertEqual(rate["new_users"], 1)
        self.assertEqual(rate["rate"], 50.0)

    def test_weekly_retention_math(self):
        """지난주 활성 4명 중 2명이 이번주 재방문 → 50%."""
        this_monday = self.today - timedelta(days=self.today.weekday())
        last_monday = this_monday - timedelta(days=7)

        retained, churned = [], []
        for i in range(2):
            u = make_user(f"ret{i}@kookmin.ac.kr")
            DailyActiveUser.objects.create(user=u, date=last_monday)
            DailyActiveUser.objects.create(user=u, date=this_monday)
            retained.append(u)
        for i in range(2):
            u = make_user(f"churn{i}@kookmin.ac.kr")
            DailyActiveUser.objects.create(user=u, date=last_monday)
            churned.append(u)

        wr = self.client.get(self.url).json()["weekly_retention"]
        self.assertEqual(wr["last_week_active_users"], 4)
        self.assertEqual(wr["retained_users"], 2)
        self.assertEqual(wr["rate"], 50.0)
        self.assertEqual(wr["last_week"]["start"], last_monday.isoformat())
        self.assertEqual(wr["last_week"]["end"], (this_monday - timedelta(days=1)).isoformat())
        self.assertEqual(wr["this_week"]["start"], this_monday.isoformat())

    def test_weekly_retention_pending_when_no_last_week_data(self):
        self.seed(make_user("only@kookmin.ac.kr"), 0)
        wr = self.client.get(self.url).json()["weekly_retention"]
        self.assertEqual(wr["status"], "pending")
        self.assertIsNone(wr["rate"])

    def test_dau_mau_ratio(self):
        u1 = make_user("x@kookmin.ac.kr")
        self.seed(u1, 0)
        self.seed(make_user("y@kookmin.ac.kr"), 20)
        self.seed(make_user("z@kookmin.ac.kr"), 25)

        body = self.client.get(self.url).json()
        self.assertEqual(body["dau"], 1)
        self.assertEqual(body["mau"]["value"], 3)
        self.assertEqual(body["dau_mau_ratio"], 33.3)

    def test_dau_mau_ratio_null_when_no_data(self):
        self.assertIsNone(self.client.get(self.url).json()["dau_mau_ratio"])


class ReactivationAnalysisTests(JwtClientMixin, TestCase):
    """
    비활성 사용자 복귀 분석.

    타임라인(정책 시행일 T 기준):
        [T-14, T-1] 비활성 판정 구간
        [T, T+13]   복귀 관찰 구간
    """

    def setUp(self):
        cache.clear()
        self.url = reverse("logs:reactivation")
        self.admin = make_user("reactadmin@kookmin.ac.kr", is_staff=True)
        self.authenticate(self.admin)

        self.today = analytics_today()
        # 관찰 구간이 이미 끝난 과거 시점을 기본 시나리오로 둔다
        self.policy_date = self.today - timedelta(days=20)
        self.iw_start = self.policy_date - timedelta(days=14)
        self.tracking_start = self.iw_start - timedelta(days=3)

    def member(self, nick, joined_before=True):
        """정책 시행일 이전/이후 가입 회원 생성."""
        u = make_user(f"{nick}@kookmin.ac.kr", nickname=nick)
        joined = (
            self.policy_date - timedelta(days=30)
            if joined_before
            else self.policy_date + timedelta(days=1)
        )
        User.objects.filter(pk=u.pk).update(
            created_at=datetime.combine(
                joined, datetime.min.time(), tzinfo=ZoneInfo("Asia/Seoul")
            )
        )
        return u

    def visit(self, user, day):
        DailyActiveUser.objects.get_or_create(user=user, date=day)

    def baseline_tracking(self):
        """
        비활성 판정 구간 전체가 측정 범위에 들도록 앵커 행을 만든다.

        앵커는 판정 구간 안에서도 한 번 방문시켜 '계속 활동 중인 회원'으로
        둔다. 그러지 않으면 앵커 자신이 비활성자로 잡혀 분모를 오염시킨다.
        """
        anchor = make_user("anchor@kookmin.ac.kr", nickname="anchor")
        User.objects.filter(pk=anchor.pk).update(
            created_at=datetime.combine(
                self.policy_date - timedelta(days=60),
                datetime.min.time(),
                tzinfo=ZoneInfo("Asia/Seoul"),
            )
        )
        self.visit(anchor, self.tracking_start)                  # 측정 시작점
        self.visit(anchor, self.policy_date - timedelta(days=7))  # 판정 구간 내
        return anchor

    def fetch(self, **params):
        params.setdefault("policy_date", self.policy_date.isoformat())
        params.setdefault("inactive_days", 14)
        params.setdefault("observation_days", 14)
        return self.client.get(self.url, params).json()

    # -- 접근 제어 -----------------------------------------------------------
    def test_requires_admin(self):
        self.authenticate(make_user("plain@kookmin.ac.kr", nickname="plain"))
        self.assertEqual(
            self.client.get(
                self.url, {"policy_date": self.policy_date.isoformat()}
            ).status_code,
            403,
        )

    def test_requires_authentication(self):
        self.logout_jwt()
        self.assertEqual(
            self.client.get(
                self.url, {"policy_date": self.policy_date.isoformat()}
            ).status_code,
            401,
        )

    def test_policy_date_required_and_validated(self):
        self.assertEqual(self.client.get(self.url).status_code, 400)
        self.assertEqual(
            self.client.get(self.url, {"policy_date": "notadate"}).status_code,
            400,
        )

    # -- 비활성 판정 ---------------------------------------------------------
    def test_inactive_user_counted(self):
        """시행 전 14일간 활동이 없는 기존 회원은 비활성자에 포함."""
        self.baseline_tracking()
        dormant = self.member("dormant")
        self.visit(dormant, self.tracking_start)  # 판정 구간 이전 방문뿐

        body = self.fetch()
        self.assertEqual(body["status"], "ready")
        self.assertIn(dormant.pk, [dormant.pk])
        self.assertEqual(body["inactive_users"], 1)

    def test_user_active_in_window_excluded(self):
        """판정 구간에 한 번이라도 방문했으면 비활성자가 아니다."""
        self.baseline_tracking()
        active = self.member("stillhere")
        self.visit(active, self.policy_date - timedelta(days=5))

        body = self.fetch()
        self.assertEqual(body["inactive_users"], 0)
        self.assertEqual(body["status"], "pending")
        self.assertIsNone(body["reactivation_rate"])

    def test_staff_excluded_from_eligible(self):
        self.baseline_tracking()
        staff = self.member("staffguy")
        User.objects.filter(pk=staff.pk).update(is_staff=True)

        body = self.fetch()
        self.assertEqual(body["eligible_users"], 1)  # anchor만
        self.assertEqual(body["inactive_users"], 0)

    def test_users_joined_after_policy_date_excluded(self):
        self.baseline_tracking()
        self.member("newcomer", joined_before=False)

        body = self.fetch()
        self.assertEqual(body["eligible_users"], 1)  # anchor만

    def test_pending_multi_major_excluded(self):
        """다부전공 미승인 회원은 DAU 행이 생길 수 없어 분모에서 제외."""
        self.baseline_tracking()
        pending_user = self.member("pendingmm")
        User.objects.filter(pk=pending_user.pk).update(
            is_multi_major=True, multi_major_approved=False
        )

        body = self.fetch()
        self.assertEqual(body["eligible_users"], 1)  # anchor만

    # -- 복귀 판정 -----------------------------------------------------------
    def test_returned_within_observation_window(self):
        self.baseline_tracking()
        comeback = self.member("comeback")
        self.visit(comeback, self.tracking_start)
        self.visit(comeback, self.policy_date + timedelta(days=3))

        body = self.fetch()
        self.assertEqual(body["inactive_users"], 1)
        self.assertEqual(body["returned_users"], 1)
        self.assertEqual(body["reactivation_rate"], 100.0)

    def test_visit_outside_observation_window_not_counted(self):
        """관찰 구간(14일)이 끝난 뒤의 방문은 복귀로 치지 않는다."""
        self.baseline_tracking()
        late = self.member("latecomer")
        self.visit(late, self.tracking_start)
        self.visit(late, self.policy_date + timedelta(days=14))  # 경계 밖

        body = self.fetch()
        self.assertEqual(body["inactive_users"], 1)
        self.assertEqual(body["returned_users"], 0)
        self.assertEqual(body["reactivation_rate"], 0.0)

    def test_rate_math(self):
        """비활성 3명 중 1명 복귀 → 33.3%."""
        self.baseline_tracking()
        for i in range(3):
            u = self.member(f"inact{i}")
            self.visit(u, self.tracking_start)
            if i == 0:
                self.visit(u, self.policy_date + timedelta(days=1))

        body = self.fetch()
        self.assertEqual(body["inactive_users"], 3)
        self.assertEqual(body["returned_users"], 1)
        self.assertEqual(body["reactivation_rate"], 33.3)

    # -- 분모 0 / 데이터 부족 -------------------------------------------------
    def test_no_inactive_users_no_division_error(self):
        self.baseline_tracking()
        body = self.fetch()
        self.assertEqual(body["inactive_users"], 0)
        self.assertIsNone(body["reactivation_rate"])
        self.assertEqual(body["status"], "pending")
        self.assertEqual(body["unavailable_reason"], "no_inactive_users")

    def test_insufficient_tracking_is_not_ready(self):
        """측정 시작이 판정 구간 중간이면 ready로 표시하면 안 된다."""
        mid = self.iw_start + timedelta(days=5)
        anchor = self.member("midanchor")
        self.visit(anchor, mid)
        dormant = self.member("dormant2")

        body = self.fetch()
        self.assertEqual(body["status"], "partial")
        self.assertEqual(body["tracking_since"], mid.isoformat())
        self.assertEqual(
            body["inactive_window"]["effective_start"], mid.isoformat()
        )
        self.assertLess(
            body["inactive_window"]["days_covered"],
            body["inactive_window"]["days"],
        )
        self.assertIsNotNone(dormant.pk)

    def test_pending_when_window_entirely_untracked(self):
        """판정 구간 전체가 측정 이전이면 비활성 판정 자체가 불가."""
        anchor = self.member("futureanchor")
        self.visit(anchor, self.policy_date + timedelta(days=2))

        body = self.fetch()
        self.assertEqual(body["status"], "pending")
        self.assertEqual(
            body["unavailable_reason"], "inactive_window_not_tracked"
        )
        self.assertIsNone(body["inactive_users"])
        self.assertIsNone(body["reactivation_rate"])

    def test_future_policy_date_is_pending(self):
        body = self.fetch(
            policy_date=(self.today + timedelta(days=3)).isoformat()
        )
        self.assertEqual(body["status"], "pending")
        self.assertEqual(body["unavailable_reason"], "policy_date_in_future")

    # -- 관찰 구간 진행 상태 --------------------------------------------------
    def test_observation_in_progress(self):
        """관찰 구간이 아직 끝나지 않았으면 진행 중으로 표시."""
        self.policy_date = self.today - timedelta(days=3)
        self.iw_start = self.policy_date - timedelta(days=14)
        self.tracking_start = self.iw_start - timedelta(days=2)
        self.baseline_tracking()

        body = self.fetch()
        self.assertTrue(body["observation_in_progress"])
        self.assertEqual(body["observation_window"]["days_elapsed"], 4)

    def test_observation_finished(self):
        body = self.fetch()
        self.assertFalse(body["observation_in_progress"])
        self.assertEqual(body["observation_window"]["days_elapsed"], 14)

    # -- 날짜 기준 -----------------------------------------------------------
    def test_windows_are_kst_based(self):
        body = self.fetch()
        self.assertEqual(body["as_of"], analytics_today().isoformat())
        self.assertEqual(
            body["inactive_window"]["start"], self.iw_start.isoformat()
        )
        self.assertEqual(
            body["inactive_window"]["end"],
            (self.policy_date - timedelta(days=1)).isoformat(),
        )
        self.assertEqual(
            body["observation_window"]["end"],
            (self.policy_date + timedelta(days=13)).isoformat(),
        )


class OperatorExclusionTests(JwtClientMixin, TestCase):
    """
    운영진(is_operator) 제외.

    수집 시점과 조회 시점 양쪽에서 걸러지는지 확인한다. 조회 시점 제외가
    중요한 이유는, 나중에 운영진으로 지정해도 과거 구간까지 같은 기준으로
    재계산되어야 추세에 가짜 하락이 생기지 않기 때문이다.
    """

    def setUp(self):
        cache.clear()
        self.today = analytics_today()
        self.admin = make_user("opadmin@kookmin.ac.kr", nickname="opadmin",
                               is_staff=True)

    def test_operator_visit_not_collected(self):
        op = make_user("op@kookmin.ac.kr", nickname="운영진A")
        User.objects.filter(pk=op.pk).update(is_operator=True)
        op.refresh_from_db()

        record_daily_active_user(op)
        self.assertEqual(DailyActiveUser.objects.count(), 0)

    def test_operator_api_request_not_collected(self):
        op = make_user("op2@kookmin.ac.kr", nickname="운영진B")
        User.objects.filter(pk=op.pk).update(is_operator=True)

        self.authenticate(op)
        self.client.get("/api/users/me/")
        self.assertEqual(DailyActiveUser.objects.count(), 0)

    def test_existing_rows_excluded_retroactively(self):
        """
        이미 쌓인 행도 운영진 지정 시 과거까지 집계에서 빠져야 한다.
        (수집 시점에만 걸렀다면 지정일을 기점으로 없던 하락이 생긴다.)
        """
        member = make_user("m@kookmin.ac.kr", nickname="일반회원")
        later_op = make_user("lateop@kookmin.ac.kr", nickname="나중운영진")
        for u in (member, later_op):
            DailyActiveUser.objects.create(user=u, date=self.today)

        self.authenticate(self.admin)
        url = reverse("logs:active-users")
        self.assertEqual(self.client.get(url).json()["dau"], 2)

        # 나중에 운영진으로 지정
        User.objects.filter(pk=later_op.pk).update(is_operator=True)
        self.assertEqual(self.client.get(url).json()["dau"], 1)

    def test_operator_excluded_from_reactivation_base(self):
        op = make_user("op3@kookmin.ac.kr", nickname="운영진C")
        member = make_user("m2@kookmin.ac.kr", nickname="일반회원2")
        policy_date = self.today - timedelta(days=20)
        joined = datetime.combine(
            policy_date - timedelta(days=30),
            datetime.min.time(),
            tzinfo=ZoneInfo("Asia/Seoul"),
        )
        User.objects.filter(pk__in=[op.pk, member.pk]).update(created_at=joined)
        User.objects.filter(pk=op.pk).update(is_operator=True)

        self.authenticate(self.admin)
        body = self.client.get(
            reverse("logs:reactivation"),
            {"policy_date": policy_date.isoformat()},
        ).json()
        self.assertEqual(body["eligible_users"], 1)  # 일반회원2만

    def test_operator_event_log_not_recorded(self):
        """EventLog는 user_id가 없어 소급 제외가 불가하므로 수집 시점에 막는다."""
        from .models import EventLog
        from .utils import create_event_log

        op = make_user("op4@kookmin.ac.kr", nickname="운영진D")
        User.objects.filter(pk=op.pk).update(is_operator=True)
        op.refresh_from_db()

        create_event_log(event_type="page_view", section="home", user=op)
        self.assertEqual(EventLog.objects.count(), 0)
