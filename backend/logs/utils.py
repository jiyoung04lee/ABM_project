from __future__ import annotations
from datetime import timedelta
from typing import TYPE_CHECKING

from django.core.cache import cache
from django.utils import timezone

from .models import EventLog, EventSetting

if TYPE_CHECKING:
    from apps.users.models import User

# 이벤트 ON/OFF 설정 캐시 키 (active event_type set)
CACHE_KEY_ACTIVE_EVENT_TYPES = "logs:event_setting:active_set"
CACHE_TIMEOUT = 60 * 60 * 24  # 24시간

# ---------------------------------------------------------------------------
# 상호작용 가중치 (히트맵 / 학년별 인기 글 집계에 사용)
# ---------------------------------------------------------------------------
EVENT_WEIGHTS: dict[str, int] = {
    "post_view": 1,
    "like": 2,
    "comment": 3,
}

INTERACTION_EVENT_TYPES = list(EVENT_WEIGHTS.keys())


# ---------------------------------------------------------------------------
# 작성자 학년 정보 추출 헬퍼
# ---------------------------------------------------------------------------
def get_author_grade_info(author: "User | None") -> dict[str, object]:
    """Post/Comment 작성자로부터 히트맵 행(i)축 정보를 추출합니다."""
    if author is None:
        return {"author_user_type": None, "author_grade_at_event": None}
    return {
        "author_user_type": author.user_type or None,
        "author_grade_at_event": (
            author.grade if author.user_type == "student" else None
        ),
    }


def get_viewer_grade_info(user: "User | None") -> dict[str, object]:
    """요청 유저(조회자)로부터 열(j)축 정보를 추출합니다."""
    if user is None or not getattr(user, "is_authenticated", False):
        return {"user_type": None, "grade_at_event": None}
    return {
        "user_type": user.user_type or None,
        "grade_at_event": user.grade if user.user_type == "student" else None,
    }


# ---------------------------------------------------------------------------
# 이벤트 설정 캐시 (ON/OFF 토글용)
# ---------------------------------------------------------------------------
def get_active_event_types() -> set[str]:
    """캐시에서 활성 event_type 집합을 반환. 없으면 DB 조회 후 캐시에 저장."""
    active = cache.get(CACHE_KEY_ACTIVE_EVENT_TYPES)
    if active is not None:
        return set(active)
    active = set(
        EventSetting.objects.filter(is_active=True).values_list(
            "event_type", flat=True
        )
    )
    cache.set(CACHE_KEY_ACTIVE_EVENT_TYPES, list(active), CACHE_TIMEOUT)
    return active


def refresh_event_setting_cache() -> None:
    """EventSetting 변경 후 호출하여 캐시를 DB 기준으로 갱신."""
    active = set(
        EventSetting.objects.filter(is_active=True).values_list(
            "event_type", flat=True
        )
    )
    cache.set(CACHE_KEY_ACTIVE_EVENT_TYPES, list(active), CACHE_TIMEOUT)


def _seconds_until_local_midnight() -> int:
    """로컬 자정까지 남은 초(최소 60). 로그인 일 1회 중복 방지 TTL용."""
    now = timezone.localtime()
    next_midnight = (now + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return max(60, int((next_midnight - now).total_seconds()))


# ---------------------------------------------------------------------------
# 메인 유틸
# ---------------------------------------------------------------------------
def create_event_log(
    *,
    event_type: str,
    section: str | None = None,
    page: str | None = None,
    post_id: int | None = None,
    # 조회자(행동 수행자)
    user_type: str | None = None,
    grade_at_event: int | None = None,
    # 작성자 (히트맵용)
    author_user_type: str | None = None,
    author_grade_at_event: int | None = None,
    # 검색어
    search_keyword: str | None = None,
    # 검색 시 행동자 관심분야 (search 이벤트용, ai/data/business)
    interest_at_event: str | None = None,
    # 세션 식별 (page_view 시 프론트에서 전달, 체류시간 집계용)
    session_id: str | None = None,
    # 유입 경로
    utm_source: str | None = None,
    # 행동 수행자(관리자면 이벤트 로그 미기록, 에러 로그만 유지)
    user: "User | None" = None,
) -> EventLog | None:
    """
    개인 식별 없이 집계용 이벤트 로그 저장.

    EventSetting에서 해당 event_type이 is_active=True일 때만 저장.
    관리자(is_staff) 사용자의 이벤트는 기록하지 않음(에러 로그만 유지).
    post_view / like / comment 이벤트는 author_user_type, author_grade_at_event 까지
    함께 저장해야 히트맵 집계가 가능합니다.

    login: 동일 계정(로그인 사용자)은 로컬 일자당 최초 1건만 저장(대시보드 중복 집계 방지).
    """
    if user is not None and getattr(user, "is_staff", False):
        return None
    if event_type not in get_active_event_types():
        return None

    # 로그인: 계정당 하루 1회만 EventLog 생성 (캐시로 원자적 중복 방지)
    if (
        event_type == "login"
        and user is not None
        and getattr(user, "is_authenticated", False)
        and getattr(user, "pk", None)
    ):
        day = timezone.localdate().isoformat()
        dedupe_key = f"eventlog:login:dedupe:{user.pk}:{day}"
        if not cache.add(dedupe_key, 1, timeout=_seconds_until_local_midnight()):
            return None

    return EventLog.objects.create(
        event_type=event_type,
        section=section,
        page=page,
        post_id=post_id,
        user_type=user_type,
        grade_at_event=grade_at_event,
        author_user_type=author_user_type,
        author_grade_at_event=author_grade_at_event,
        search_keyword=(search_keyword or "")[:100] or None,
        interest_at_event=(interest_at_event or "").strip()[:30] or None,
        session_id=(session_id or "").strip()[:64] or None,
        utm_source=utm_source,
    )
