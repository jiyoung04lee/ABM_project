"""
새 글 운영진 메일 알림 (네트워크·커뮤니티).

흐름:
    글 작성(perform_create) → schedule_new_post_alert
    → DB 커밋 후 NewPostAlert 기록 생성 → 발송 대기열에 넣음
    → 프로세스당 1개인 백그라운드 발송 스레드가 순서대로 발송
      (글 작성 응답은 발송을 기다리지 않음)
    → 성공/실패 기록. 실패·대기 건은 다음 알림을 보낼 때 함께 재시도
      (최근 24시간, 최대 3회, 재시도 간격 5분·10분).
      수동 재시도: `python manage.py retry_new_post_alerts [--all] [--reset]`

메일에는 게시판·제목·작성 시각·링크만 담고, 작성자와 본문은 넣지 않는다 (익명 글 보호).
운영진(is_staff)이 쓴 글, 수신 주소(NEW_POST_ALERT_EMAIL)가 없을 때는 보내지 않는다.
관리자 OTP 메일과 같은 Gmail 계정을 쓰므로, 시간당 발송 수를 제한해 한도를 지킨다.
"""
from __future__ import annotations

import logging
import queue
import threading
from collections import Counter
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.db import connection, transaction
from django.db.models import F, Q
from django.utils import timezone

from .models import NewPostAlert

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 3
RETRY_WINDOW = timedelta(hours=24)
# 실패 후 다시 보내기까지 기다리는 시간 = RETRY_BACKOFF × 시도 횟수 (5분, 10분)
RETRY_BACKOFF = timedelta(minutes=5)
# 발송 도중 워커가 재시작되면 '발송 중'으로 남는다. 이 시간이 지나면 다시 보낸다.
STALE_SENDING_AFTER = timedelta(minutes=10)
# 한 번에 함께 재시도하는 최대 건수
RETRY_BATCH_SIZE = 20
# 시간당 발송 한도 기본값 (settings.NEW_POST_ALERT_MAX_PER_HOUR로 변경 가능)
DEFAULT_MAX_PER_HOUR = 30
SENT_COUNT_CACHE_PREFIX = "new_post_alert:sent"

BOARD_LABELS = {"community": "커뮤니티", "network": "네트워크"}


def alert_recipients() -> list[str]:
    raw = getattr(settings, "NEW_POST_ALERT_EMAIL", "") or ""
    return [email.strip() for email in raw.split(",") if email.strip()]


def schedule_new_post_alert(post, board: str) -> None:
    """글 저장이 커밋된 뒤 알림을 보낸다. 글 작성 흐름에서 예외를 내지 않는다."""
    try:
        author = getattr(post, "author", None)
        if author is not None and getattr(author, "is_staff", False):
            return
        if board not in BOARD_LABELS or not alert_recipients():
            return
        post_id = post.pk
        transaction.on_commit(lambda: _start_delivery(board, post_id))
    except Exception:
        logger.exception("새 글 알림 예약 실패: %s#%s", board, getattr(post, "pk", None))


def _start_delivery(board: str, post_id: int) -> None:
    try:
        alert, _ = NewPostAlert.objects.get_or_create(board=board, post_id=post_id)
    except Exception:
        logger.exception("새 글 알림 기록 생성 실패: %s#%s", board, post_id)
        return

    if getattr(settings, "NEW_POST_ALERT_SYNC", False):
        deliver_alerts(primary_id=alert.pk)
        return
    _enqueue(alert.pk)


# ---------------------------------------------------------------------------
# 백그라운드 발송: 프로세스당 발송 스레드 1개 + 대기열
# (글이 몰려도 스레드·DB 연결이 늘어나지 않는다. 대기열이 꽉 차면 알림은
#  '대기' 상태로 남아 다음 발송 때 함께 재시도된다.)
# ---------------------------------------------------------------------------
_QUEUE_MAX = 100
_queue: queue.Queue[int] = queue.Queue(maxsize=_QUEUE_MAX)
_worker: threading.Thread | None = None
_worker_lock = threading.Lock()


def _enqueue(alert_id: int) -> None:
    try:
        _queue.put_nowait(alert_id)
    except queue.Full:
        logger.warning("새 글 알림 대기열이 가득 차 다음 발송 때 재시도: alert=%s", alert_id)
        return
    _ensure_worker()


def _ensure_worker() -> None:
    global _worker
    with _worker_lock:
        if _worker is None or not _worker.is_alive():
            _worker = threading.Thread(
                target=_worker_loop, name="new-post-alert", daemon=True
            )
            _worker.start()


def _worker_loop() -> None:
    while True:
        alert_id = _queue.get()
        try:
            deliver_alerts(primary_id=alert_id)
        except Exception:
            logger.exception("새 글 알림 발송 오류: alert=%s", alert_id)
        finally:
            # 다음 작업까지 DB 연결을 붙잡지 않는다
            connection.close()
            _queue.task_done()


# ---------------------------------------------------------------------------
# 발송
# ---------------------------------------------------------------------------
def _retryable_filter(now) -> Q:
    """
    다시 보낼 수 있는 상태:
    - 대기(pending)
    - 실패(failed) 후 재시도 간격(5분 × 시도 횟수)이 지난 것
    - '발송 중'으로 오래 멈춘 것 (워커가 발송 도중 종료된 경우)
    """
    failed_ready = Q()
    for attempts in range(1, MAX_ATTEMPTS):
        failed_ready |= Q(attempts=attempts, updated_at__lt=now - RETRY_BACKOFF * attempts)
    return (
        Q(status=NewPostAlert.STATUS_PENDING)
        | (Q(status=NewPostAlert.STATUS_FAILED) & failed_ready)
        | Q(status=NewPostAlert.STATUS_SENDING, updated_at__lt=now - STALE_SENDING_AFTER)
    )


def retryable_alerts(window: timedelta | None = RETRY_WINDOW):
    """다시 보낼 대상 (시도 3회 미만). window가 None이면 기간 제한 없음."""
    now = timezone.now()
    qs = NewPostAlert.objects.filter(attempts__lt=MAX_ATTEMPTS).filter(
        _retryable_filter(now)
    )
    if window is not None:
        qs = qs.filter(created_at__gte=now - window)
    return qs


def deliver_alerts(
    primary_id: int | None = None,
    window: timedelta | None = RETRY_WINDOW,
) -> dict[str, int]:
    """primary 알림을 보내고, 재시도 대상도 함께 보낸다. 결과 상태별 건수를 돌려준다."""
    ids: list[int] = [primary_id] if primary_id else []
    retry_ids = (
        retryable_alerts(window)
        .exclude(pk=primary_id)
        .order_by("created_at")
        .values_list("pk", flat=True)[:RETRY_BATCH_SIZE]
    )
    ids.extend(retry_ids)

    results: Counter[str] = Counter()
    for alert_id in ids:
        results[_deliver_one(alert_id)] += 1
    results.pop("not_claimed", None)
    return dict(results)


def reset_exhausted_alerts(window: timedelta | None = RETRY_WINDOW) -> int:
    """
    시도 횟수를 다 쓴 실패·멈춘 알림을 처음 상태로 되돌린다 (수동 복구용).
    예: Gmail 앱 비밀번호를 고친 뒤 `retry_new_post_alerts --reset`.
    """
    now = timezone.now()
    qs = NewPostAlert.objects.filter(
        Q(status=NewPostAlert.STATUS_FAILED)
        | Q(status=NewPostAlert.STATUS_SENDING, updated_at__lt=now - STALE_SENDING_AFTER)
    )
    if window is not None:
        qs = qs.filter(created_at__gte=now - window)
    return qs.update(
        status=NewPostAlert.STATUS_PENDING, attempts=0, last_error="", updated_at=now
    )


def _claim(alert_id: int) -> bool:
    """
    동시에 여러 곳에서 같은 알림을 보내지 않도록, 상태를 '발송 중'으로
    원자적으로 바꾼 쪽만 발송한다. (update는 auto_now를 건너뛰므로 updated_at을 직접 넣는다)
    """
    now = timezone.now()
    claimed = (
        NewPostAlert.objects.filter(pk=alert_id, attempts__lt=MAX_ATTEMPTS)
        .filter(_retryable_filter(now))
        .update(
            status=NewPostAlert.STATUS_SENDING,
            attempts=F("attempts") + 1,
            updated_at=now,
        )
    )
    return claimed == 1


def _finish(alert_id: int, status: str, error: str = "") -> None:
    now = timezone.now()
    NewPostAlert.objects.filter(pk=alert_id).update(
        status=status,
        last_error=error[:500],
        updated_at=now,
        sent_at=now if status == NewPostAlert.STATUS_SENT else None,
    )


def _hourly_key(now) -> str:
    return f"{SENT_COUNT_CACHE_PREFIX}:{timezone.localtime(now):%Y%m%d%H}"


def _hourly_limit_reached(now) -> bool:
    limit = getattr(settings, "NEW_POST_ALERT_MAX_PER_HOUR", DEFAULT_MAX_PER_HOUR)
    return (cache.get(_hourly_key(now)) or 0) >= limit


def _count_sent(now) -> None:
    key = _hourly_key(now)
    if not cache.add(key, 1, timeout=60 * 60):
        try:
            cache.incr(key)
        except ValueError:  # 사이에 만료된 경우
            cache.set(key, 1, timeout=60 * 60)


def _deliver_one(alert_id: int) -> str:
    if not _claim(alert_id):
        return "not_claimed"

    alert = NewPostAlert.objects.get(pk=alert_id)
    post = _load_post(alert.board, alert.post_id)
    if post is None:
        _finish(alert_id, NewPostAlert.STATUS_SKIPPED, "발송 전에 글이 삭제되어 보내지 않음")
        return NewPostAlert.STATUS_SKIPPED

    recipients = alert_recipients()
    if not recipients:
        _finish(alert_id, NewPostAlert.STATUS_SKIPPED, "수신 주소(NEW_POST_ALERT_EMAIL)가 없음")
        return NewPostAlert.STATUS_SKIPPED

    now = timezone.now()
    if _hourly_limit_reached(now):
        # 관리자 OTP 메일과 같은 Gmail 계정이라, 글이 몰려도 한도를 넘기지 않는다
        _finish(alert_id, NewPostAlert.STATUS_SKIPPED, "시간당 발송 한도 초과로 보내지 않음")
        return NewPostAlert.STATUS_SKIPPED

    subject, body = build_alert_message(alert.board, post)
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipients,
            fail_silently=False,
        )
    except Exception as exc:
        logger.warning("새 글 알림 메일 발송 실패: %s#%s (%s)", alert.board, alert.post_id, exc)
        _finish(alert_id, NewPostAlert.STATUS_FAILED, f"{type(exc).__name__}: {exc}")
        return NewPostAlert.STATUS_FAILED

    _count_sent(now)
    _finish(alert_id, NewPostAlert.STATUS_SENT)
    return NewPostAlert.STATUS_SENT


def _load_post(board: str, post_id: int):
    if board == "community":
        from apps.community.models import Post
    elif board == "network":
        from apps.networks.models import Post
    else:
        return None
    return (
        Post.objects.select_related("category")
        .filter(pk=post_id, is_deleted=False)
        .first()
    )


def build_alert_message(board: str, post) -> tuple[str, str]:
    """메일 제목·본문. 작성자와 본문은 넣지 않는다."""
    board_label = BOARD_LABELS[board]
    path = [board_label]
    if board == "network":
        path.append(post.get_type_display())
    category = getattr(post, "category", None)
    if category is not None:
        path.append(category.name)

    site_url = (getattr(settings, "SITE_URL", "") or "").rstrip("/")
    created = timezone.localtime(post.created_at)
    title = " ".join(str(post.title or "").split())  # 줄바꿈 등 정리

    subject = f"[AIVE] {board_label}에 새 글이 올라왔어요"
    body = "\n".join(
        [
            f"{board_label}에 새 글이 올라왔어요.",
            "",
            f"· 게시판: {' > '.join(path)}",
            f"· 제목: {title}",
            f"· 작성 시각: {created:%Y-%m-%d %H:%M}",
            f"· 링크: {site_url}/{board}/{post.pk}",
        ]
    )
    return subject, body
