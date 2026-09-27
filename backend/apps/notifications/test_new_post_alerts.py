"""새 글 운영진 메일 알림 테스트 (apps/notifications/new_post_alerts.py)."""
import itertools
import threading
from datetime import timedelta
from io import StringIO
from smtplib import SMTPException
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework_simplejwt.tokens import AccessToken

from apps.community.models import Category as CommunityCategory
from apps.community.models import Post as CommunityPost
from apps.networks.models import Category as NetworkCategory

from . import new_post_alerts
from .models import NewPostAlert
from .new_post_alerts import MAX_ATTEMPTS, _start_delivery, deliver_alerts

User = get_user_model()
_seq = itertools.count(1)

ALERT_SETTINGS = dict(
    NEW_POST_ALERT_EMAIL="ops@example.com",
    NEW_POST_ALERT_SYNC=True,
    SITE_URL="https://www.abmaive.com",
    DEFAULT_FROM_EMAIL="noreply@example.com",
)


def make_user(**extra):
    n = next(_seq)
    extra.setdefault("nickname", f"writer{n}")
    extra.setdefault("user_type", "student")
    extra.setdefault("grade", 3)
    extra.setdefault("is_profile_complete", True)
    return User.objects.create_user(
        email=f"writer{n}@kookmin.ac.kr", password="pw-test-1234", **extra
    )


@override_settings(**ALERT_SETTINGS)
class NewPostAlertTests(TestCase):
    def setUp(self):
        cache.clear()  # 시간당 발송 수 카운터 초기화
        self.user = make_user(nickname="작성자닉네임")
        self.community_category = CommunityCategory.objects.create(
            name="자유", slug="alert-free", group="community"
        )
        self.network_category = NetworkCategory.objects.create(
            type="student", name="인턴", slug="alert-intern"
        )

    def login(self, user):
        self.client.cookies["access_token"] = str(AccessToken.for_user(user))

    def create_community_post(self, user=None, title="수강신청 꿀팁", anonymous=False):
        self.login(user or self.user)
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(
                "/api/community/posts/",
                {
                    "title": title,
                    "content": "<p>본문에만 있는 비밀 내용</p>",
                    "category": self.community_category.pk,
                    "is_anonymous": anonymous,
                },
            )

    def create_network_post(self, user=None, title="ICT 인턴십 후기"):
        self.login(user or self.user)
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(
                "/api/networks/posts/",
                {
                    "type": "student",
                    "title": title,
                    "content": "<p>본문에만 있는 비밀 내용</p>",
                    "category": self.network_category.pk,
                    "is_anonymous": False,
                },
            )

    # -- 기본 발송 -----------------------------------------------------------
    def test_community_post_sends_one_mail(self):
        res = self.create_community_post()
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        post = CommunityPost.objects.get(title="수강신청 꿀팁")
        self.assertEqual(message.subject, "[AIVE] 커뮤니티에 새 글이 올라왔어요")
        self.assertEqual(message.to, ["ops@example.com"])
        self.assertIn("· 게시판: 커뮤니티 > 자유", message.body)
        self.assertIn("· 제목: 수강신청 꿀팁", message.body)
        self.assertIn(f"https://www.abmaive.com/community/{post.pk}", message.body)
        alert = NewPostAlert.objects.get(board="community", post_id=post.pk)
        self.assertEqual(alert.status, NewPostAlert.STATUS_SENT)
        self.assertIsNotNone(alert.sent_at)

    def test_network_post_includes_type(self):
        res = self.create_network_post()
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(len(mail.outbox), 1)
        body = mail.outbox[0].body
        self.assertEqual(mail.outbox[0].subject, "[AIVE] 네트워크에 새 글이 올라왔어요")
        self.assertIn("· 게시판: 네트워크 > 재학생 > 인턴", body)
        self.assertIn("/network/", body)

    def test_mail_has_no_author_or_body(self):
        self.create_community_post(anonymous=True)
        body = mail.outbox[0].body
        self.assertNotIn("작성자닉네임", body)
        self.assertNotIn(self.user.email, body)
        self.assertNotIn("비밀 내용", body)

    def test_created_time_is_kst(self):
        self.create_community_post()
        post = CommunityPost.objects.get()
        kst = timezone.localtime(post.created_at)
        self.assertIn(f"· 작성 시각: {kst:%Y-%m-%d %H:%M}", mail.outbox[0].body)

    # -- 보내지 않는 경우 ------------------------------------------------------
    def test_staff_post_not_alerted(self):
        res = self.create_community_post(user=make_user(is_staff=True))
        self.assertEqual(res.status_code, 201)
        self.assertEqual(len(mail.outbox), 0)
        self.assertFalse(NewPostAlert.objects.exists())

    @override_settings(NEW_POST_ALERT_EMAIL="")
    def test_no_recipient_means_off(self):
        res = self.create_community_post()
        self.assertEqual(res.status_code, 201)
        self.assertEqual(len(mail.outbox), 0)
        self.assertFalse(NewPostAlert.objects.exists())

    def test_deleted_before_send_is_skipped(self):
        post = CommunityPost.objects.create(
            author=self.user, category=self.community_category,
            title="곧 삭제", content="x", is_deleted=True,
        )
        _start_delivery("community", post.pk)
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(NewPostAlert.objects.get().status, NewPostAlert.STATUS_SKIPPED)

    # -- 실패와 재시도 ---------------------------------------------------------
    def test_mail_failure_does_not_break_post_creation(self):
        with patch(
            "apps.notifications.new_post_alerts.send_mail",
            side_effect=SMTPException("smtp down"),
        ):
            res = self.create_community_post()
        self.assertEqual(res.status_code, 201)
        alert = NewPostAlert.objects.get()
        self.assertEqual(alert.status, NewPostAlert.STATUS_FAILED)
        self.assertEqual(alert.attempts, 1)
        self.assertIn("smtp down", alert.last_error)

    def test_failed_alert_waits_for_backoff(self):
        """실패 직후에는 재시도하지 않고, 간격(5분 × 시도 횟수)이 지나야 다시 보낸다."""
        with patch(
            "apps.notifications.new_post_alerts.send_mail",
            side_effect=SMTPException("smtp down"),
        ):
            self.create_community_post(title="첫 글")
        self.assertEqual(deliver_alerts(), {})
        NewPostAlert.objects.update(updated_at=timezone.now() - timedelta(minutes=6))
        self.assertEqual(deliver_alerts(), {NewPostAlert.STATUS_SENT: 1})

    def test_failed_alert_retried_with_next_post(self):
        with patch(
            "apps.notifications.new_post_alerts.send_mail",
            side_effect=SMTPException("smtp down"),
        ):
            self.create_community_post(title="첫 글")
        NewPostAlert.objects.update(updated_at=timezone.now() - timedelta(minutes=6))
        self.create_network_post(title="둘째 글")

        self.assertEqual(len(mail.outbox), 2)
        self.assertEqual(
            set(NewPostAlert.objects.values_list("status", flat=True)),
            {NewPostAlert.STATUS_SENT},
        )
        first = NewPostAlert.objects.get(board="community")
        self.assertEqual(first.attempts, 2)

    def test_gives_up_after_max_attempts(self):
        post = CommunityPost.objects.create(
            author=self.user, category=self.community_category, title="t", content="x"
        )
        NewPostAlert.objects.create(
            board="community", post_id=post.pk,
            status=NewPostAlert.STATUS_FAILED, attempts=MAX_ATTEMPTS,
        )
        self.assertEqual(deliver_alerts(), {})
        self.assertEqual(len(mail.outbox), 0)

    def test_old_failures_not_auto_retried_but_command_all_does(self):
        post = CommunityPost.objects.create(
            author=self.user, category=self.community_category, title="오래된 글", content="x"
        )
        alert = NewPostAlert.objects.create(
            board="community", post_id=post.pk, status=NewPostAlert.STATUS_FAILED, attempts=1
        )
        NewPostAlert.objects.filter(pk=alert.pk).update(
            created_at=timezone.now() - timedelta(days=3),
            updated_at=timezone.now() - timedelta(days=3),
        )
        self.assertEqual(deliver_alerts(), {})

        out = StringIO()
        call_command("retry_new_post_alerts", "--all", stdout=out)
        self.assertIn("sent 1건", out.getvalue())
        self.assertEqual(len(mail.outbox), 1)

    def test_stale_sending_is_reclaimed_fresh_is_not(self):
        post = CommunityPost.objects.create(
            author=self.user, category=self.community_category, title="t", content="x"
        )
        alert = NewPostAlert.objects.create(
            board="community", post_id=post.pk, status=NewPostAlert.STATUS_SENDING, attempts=1
        )
        self.assertEqual(deliver_alerts(), {})  # 방금 '발송 중' → 다른 곳에서 보내는 중으로 본다
        NewPostAlert.objects.filter(pk=alert.pk).update(
            updated_at=timezone.now() - timedelta(minutes=30)
        )
        self.assertEqual(deliver_alerts(), {NewPostAlert.STATUS_SENT: 1})

    def test_same_post_sent_only_once(self):
        post = CommunityPost.objects.create(
            author=self.user, category=self.community_category, title="t", content="x"
        )
        _start_delivery("community", post.pk)
        _start_delivery("community", post.pk)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(NewPostAlert.objects.count(), 1)

    # -- 발송 한도·수동 복구 --------------------------------------------------
    @override_settings(NEW_POST_ALERT_MAX_PER_HOUR=1)
    def test_hourly_limit_protects_gmail_quota(self):
        cache.clear()
        self.create_community_post(title="첫 글")
        self.create_community_post(title="둘째 글")
        self.assertEqual(len(mail.outbox), 1)
        skipped = NewPostAlert.objects.get(status=NewPostAlert.STATUS_SKIPPED)
        self.assertIn("한도", skipped.last_error)

    def test_command_reset_resends_exhausted_alerts(self):
        post = CommunityPost.objects.create(
            author=self.user, category=self.community_category, title="t", content="x"
        )
        NewPostAlert.objects.create(
            board="community", post_id=post.pk,
            status=NewPostAlert.STATUS_FAILED, attempts=MAX_ATTEMPTS, last_error="auth",
        )
        out = StringIO()
        call_command("retry_new_post_alerts", "--reset", stdout=out)
        self.assertIn("1건의 시도 횟수를 초기화", out.getvalue())
        self.assertEqual(len(mail.outbox), 1)
        alert = NewPostAlert.objects.get()
        self.assertEqual((alert.status, alert.attempts), (NewPostAlert.STATUS_SENT, 1))

    def test_command_sends_more_than_one_batch(self):
        cache.clear()
        for i in range(25):
            post = CommunityPost.objects.create(
                author=self.user, category=self.community_category, title=f"t{i}", content="x"
            )
            NewPostAlert.objects.create(board="community", post_id=post.pk)
        out = StringIO()
        call_command("retry_new_post_alerts", stdout=out)
        self.assertIn("sent 25건", out.getvalue())
        self.assertEqual(len(mail.outbox), 25)

    # -- 백그라운드 발송 ------------------------------------------------------
    @override_settings(NEW_POST_ALERT_SYNC=False)
    def test_response_does_not_wait_for_mail(self):
        with patch("apps.notifications.new_post_alerts._enqueue") as enqueue:
            res = self.create_community_post()
        self.assertEqual(res.status_code, 201)
        self.assertEqual(len(mail.outbox), 0)  # 응답 시점에는 아직 보내지 않았다
        enqueue.assert_called_once_with(NewPostAlert.objects.get().pk)

    def test_command_without_recipient(self):
        err = StringIO()
        with override_settings(NEW_POST_ALERT_EMAIL=""):
            call_command("retry_new_post_alerts", stderr=err)
        self.assertIn("NEW_POST_ALERT_EMAIL", err.getvalue())


@override_settings(**{**ALERT_SETTINGS, "NEW_POST_ALERT_SYNC": False})
class BackgroundWorkerTests(TransactionTestCase):
    """실제 발송 스레드가 대기열의 알림을 보내는지 (스레드는 별도 DB 연결을 쓰므로 커밋된 데이터 필요)."""

    def setUp(self):
        cache.clear()

    def tearDown(self):
        new_post_alerts._queue.join()

    def test_worker_thread_delivers_queued_alerts(self):
        user = make_user()
        category = CommunityCategory.objects.create(name="자유", slug="bg-free", group="community")
        alerts = []
        for i in range(3):
            post = CommunityPost.objects.create(
                author=user, category=category, title=f"백그라운드 {i}", content="x"
            )
            alerts.append(NewPostAlert.objects.create(board="community", post_id=post.pk))
        # 기록을 모두 만든 뒤 대기열에 넣는다 (테스트 DB인 SQLite는 두 스레드의 동시 쓰기를 막으므로)
        for alert in alerts:
            new_post_alerts._enqueue(alert.pk)
        new_post_alerts._queue.join()  # 발송 스레드가 대기열을 다 처리할 때까지

        self.assertEqual(len(mail.outbox), 3)
        self.assertEqual(
            set(NewPostAlert.objects.values_list("status", flat=True)),
            {NewPostAlert.STATUS_SENT},
        )
        workers = [t for t in threading.enumerate() if t.name == "new-post-alert"]
        self.assertEqual(len(workers), 1)  # 글이 여러 개여도 발송 스레드는 하나
        self.assertTrue(workers[0].daemon)
