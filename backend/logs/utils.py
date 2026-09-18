from __future__ import annotations
from datetime import date, timedelta
from typing import TYPE_CHECKING
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from .models import DailyActiveUser, EventLog, EventSetting

if TYPE_CHECKING:
    from apps.users.models import User

# 이벤트 ON/OFF 설정 캐시 키 (active event_type set)
CACHE_KEY_ACTIVE_EVENT_TYPES = "logs:event_setting:active_set"
CACHE_TIMEOUT = 60 * 60 * 24  # 24시간

# 일별 활성 사용자 dedupe 캐시 키 프리픽스
CACHE_KEY_DAU_PREFIX = "logs:dau"

# 분석 기준 타임존 fallback (settings.ANALYTICS_TIME_ZONE 미설정 시)
DEFAULT_ANALYTICS_TIME_ZONE = "Asia/Seoul"

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


def get_viewer_interest_info(user: "User | None") -> dict[str, str | None]:
    """온보딩 관심분야(첫 번째 선택) — post_view 등 UGC 이벤트용."""
    if user is None or not getattr(user, "is_authenticated", False):
        return {"interest_at_event": None}
    interests = getattr(user, "interests", None) or []
    if interests and interests[0] in ("ai", "data", "business"):
        return {"interest_at_event": interests[0]}
    return {"interest_at_event": None}


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
# 분석 기준 날짜
#
# ANALYTICS_TIME_ZONE은 기본값이 TIME_ZONE(Asia/Seoul)이라 지금은 둘이 같다.
# 그래도 헬퍼를 남겨두는 이유는, DailyActiveUser가 date를 직접 저장하기 때문에
# "어느 타임존으로 날짜를 찍는가"가 저장 시점에 확정되기 때문이다.
# 집계 기준을 바꾸려면 이 한 곳만 보면 된다.
# ---------------------------------------------------------------------------
def get_analytics_timezone() -> ZoneInfo:
    """분석 집계 기준 타임존."""
    name = getattr(
        settings, "ANALYTICS_TIME_ZONE", DEFAULT_ANALYTICS_TIME_ZONE
    )
    return ZoneInfo(name)


def analytics_today() -> date:
    """분석 기준(Asia/Seoul) 오늘 날짜."""
    return timezone.now().astimezone(get_analytics_timezone()).date()


def _seconds_until_analytics_midnight() -> int:
    """분석 기준 타임존의 자정까지 남은 초(최소 60). DAU dedupe TTL용."""
    now = timezone.now().astimezone(get_analytics_timezone())
    next_midnight = (now + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return max(60, int((next_midnight - now).total_seconds()))


def record_daily_active_user(user: "User | None") -> None:
    """
    인증 사용자의 '오늘 방문'을 DailyActiveUser에 1행 기록.

    정확성은 DB의 UniqueConstraint(user, date)가 보장하고,
    캐시는 순전히 하루 1회로 DB 접근을 줄이기 위한 것이다.
    (캐시가 빗나가도 get_or_create가 기존 행을 되돌려줄 뿐 중복 생성은 없다.)

    운영자(is_staff)·운영진(is_operator)은 집계에서 제외한다. 다만 이 행은
    ActiveUserStatsView 쪽에서 조회 시점에도 한 번 더 걸러지는데, 운영진 지정이
    나중에 바뀌어도 과거 구간까지 같은 기준으로 재계산되게 하기 위함이다.
    """
    from apps.users.exclusions import is_excluded_account

    if user is None or not getattr(user, "is_authenticated", False):
        return
    if is_excluded_account(user):
        return
    user_pk = getattr(user, "pk", None)
    if not user_pk:
        return

    today = analytics_today()
    cache_key = f"{CACHE_KEY_DAU_PREFIX}:{user_pk}:{today.isoformat()}"
    if not cache.add(cache_key, 1, timeout=_seconds_until_analytics_midnight()):
        return  # 오늘 이미 기록됨 → DB 접근 없음

    DailyActiveUser.objects.get_or_create(user_id=user_pk, date=today)


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
    # 검색 시 행동자 관심분야 (search / post_view / like / comment)
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
    운영자(is_staff)·운영진(is_operator) 이벤트는 기록하지 않음(에러 로그만 유지).
    EventLog에는 user_id가 없어 소급 제외가 불가능하므로 수집 시점에 걸러야 한다.
    post_view / like / comment 이벤트는 author_user_type, author_grade_at_event 까지
    함께 저장해야 히트맵 집계가 가능합니다.

    login: 동일 계정(로그인 사용자)은 로컬 일자당 최초 1건만 저장(대시보드 중복 집계 방지).
    """
    from apps.users.exclusions import is_excluded_account

    if is_excluded_account(user):
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
