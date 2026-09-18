"""
DailyActiveUser 수집(미들웨어) 테스트.

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
