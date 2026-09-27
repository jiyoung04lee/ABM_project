from __future__ import annotations
import re
from contextvars import ContextVar
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

# 방문자 유형 캐시 키 프리픽스 (사용자·날짜별 1회 계산)
CACHE_KEY_VISITOR_TYPE_PREFIX = "logs:visitor_type"

# 가입 후 이 일수 이내면 '신규 회원'
NEW_MEMBER_DAYS = 7
# 직전 활동 후 이 일수 이상 지나 돌아오면 '휴면 복귀 회원'
DORMANT_DAYS = 30


# ---------------------------------------------------------------------------
# 요청 단위 세션 ID (EventContextMiddleware가 X-Session-Id 헤더로 채움)
#
# create_event_log 호출부마다 세션 ID를 넘기지 않아도, 같은 요청에서 기록되는
# 모든 이벤트(글 조회·좋아요·댓글·검색 등)에 방문 단위 ID가 붙도록 한다.
# ---------------------------------------------------------------------------
_request_session_id: ContextVar[str | None] = ContextVar(
    "logs_request_session_id", default=None
)

_SESSION_ID_RE = re.compile(r"^[A-Za-z0-9_\-]{1,64}$")


def normalize_session_id(value: object) -> str | None:
    """프론트가 만든 세션 ID 형식(영문·숫자·_·-, 최대 64자)만 허용."""
    text = str(value or "").strip()
    return text if _SESSION_ID_RE.match(text) else None


def set_request_session_id(value: str | None):
    return _request_session_id.set(normalize_session_id(value))


def reset_request_session_id(token) -> None:
    _request_session_id.reset(token)


def get_request_session_id() -> str | None:
    return _request_session_id.get()


# ---------------------------------------------------------------------------
# 짧은 문자열 정리 (utm, referrer, properties 값 등 외부 입력용)
# ---------------------------------------------------------------------------
_CONTROL_CHARS_RE = re.compile(r"[\x00-\x1f\x7f]")


def clean_short_text(value: object, max_length: int) -> str:
    """제어문자를 제거하고 앞뒤 공백을 정리한 뒤 max_length로 자른다."""
    if value is None or isinstance(value, (dict, list)):
        return ""
    text = _CONTROL_CHARS_RE.sub("", str(value)).strip()
    return text[:max_length]


_REFERRER_HOST_RE = re.compile(r"^[a-z0-9.\-:]{1,100}$")


def clean_referrer_host(value: object) -> str:
    """referrer는 호스트명만 받는다 (예: l.instagram.com). 형식이 다르면 빈 문자열."""
    text = str(value or "").strip().lower()
    return text if _REFERRER_HOST_RE.match(text) else ""


PROPERTIES_MAX_KEYS = 10
PROPERTIES_MAX_KEY_LENGTH = 30
PROPERTIES_MAX_VALUE_LENGTH = 100


def clean_properties(properties: dict | None) -> dict:
    """properties는 짧은 스칼라 값만, 최대 10개 키까지 저장한다."""
    if not isinstance(properties, dict):
        return {}
    cleaned: dict[str, object] = {}
    for key, value in properties.items():
        if len(cleaned) >= PROPERTIES_MAX_KEYS:
            break
        key_text = clean_short_text(key, PROPERTIES_MAX_KEY_LENGTH)
        if not key_text:
            continue
        if isinstance(value, (bool, int)):
            cleaned[key_text] = value
        elif isinstance(value, str):
            text = clean_short_text(value, PROPERTIES_MAX_VALUE_LENGTH)
            if text:
                cleaned[key_text] = text
    return cleaned

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

    관리자(is_staff)는 create_event_log와 동일하게 집계에서 제외한다.
    """
    if user is None or not getattr(user, "is_authenticated", False):
        return
    if getattr(user, "is_staff", False):
        return
    user_pk = getattr(user, "pk", None)
    if not user_pk:
        return

    today = analytics_today()
    cache_key = f"{CACHE_KEY_DAU_PREFIX}:{user_pk}:{today.isoformat()}"
    if not cache.add(cache_key, 1, timeout=_seconds_until_analytics_midnight()):
        return  # 오늘 이미 기록됨 → DB 접근 없음

    DailyActiveUser.objects.get_or_create(user_id=user_pk, date=today)


def visitor_type_cache_key(user_pk: int, day: date) -> str:
    return f"{CACHE_KEY_VISITOR_TYPE_PREFIX}:{user_pk}:{day.isoformat()}"


def forget_visitor_type(user: "User | None") -> None:
    """가입 완료처럼 방문자 유형이 바뀌는 시점에 오늘 캐시를 지운다."""
    user_pk = getattr(user, "pk", None)
    if user_pk:
        cache.delete(visitor_type_cache_key(user_pk, analytics_today()))


def resolve_visitor_type(user: "User | None") -> str:
    """
    행동 시점의 방문자 유형.

    - guest: 비로그인
    - new: 가입 진행 중이거나, 가입(온보딩 완료) 후 NEW_MEMBER_DAYS일 이내
    - returning: 직전 활동일로부터 DORMANT_DAYS일 이상 지나 다시 온 회원
    - member: 그 외 기존 회원

    가입 시점은 온보딩 완료 시각(profile_completed_at)을 쓰고, 그 필드가 생기기 전
    가입자는 계정 생성 시각(created_at)으로 대신한다. (카카오 로그인만 하고 온보딩을
    한참 뒤에 마친 사용자가 가입 당일 returning으로 잡히지 않도록)
    직전 활동일은 DailyActiveUser(오늘 이전)를 우선 보고, 기록이 없으면
    로그인 점수 지급일(last_login_point_date)로 대신한다. (DAU 수집 시작 전 가입자 대비)
    사용자·날짜별로 한 번만 계산해 캐시하므로, 휴면 회원이 돌아온 날의
    이벤트는 그날 내내 returning으로 남는다.
    """
    if user is None or not getattr(user, "is_authenticated", False):
        return "guest"
    user_pk = getattr(user, "pk", None)
    if not user_pk:
        return "guest"
    if not getattr(user, "is_profile_complete", True):
        return "new"  # 가입 진행 중 — 완료 시점에 다시 계산되도록 캐시하지 않음

    today = analytics_today()
    cache_key = visitor_type_cache_key(user_pk, today)
    cached = cache.get(cache_key)
    if cached:
        return cached

    visitor_type = "member"
    joined_at = getattr(user, "profile_completed_at", None) or getattr(
        user, "created_at", None
    )
    joined = (
        joined_at.astimezone(get_analytics_timezone()).date()
        if joined_at
        else None
    )
    if joined and (today - joined).days < NEW_MEMBER_DAYS:
        visitor_type = "new"
    else:
        last_active = (
            DailyActiveUser.objects.filter(user_id=user_pk, date__lt=today)
            .order_by("-date")
            .values_list("date", flat=True)
            .first()
        )
        if last_active is None:
            point_date = getattr(user, "last_login_point_date", None)
            if point_date and point_date < today:
                last_active = point_date
        if last_active and (today - last_active).days >= DORMANT_DAYS:
            visitor_type = "returning"

    cache.set(cache_key, visitor_type, _seconds_until_analytics_midnight())
    return visitor_type


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
    # 세션 식별. 생략하면 요청의 X-Session-Id 헤더 값을 사용
    session_id: str | None = None,
    # 유입 경로
    utm_source: str | None = None,
    # 이벤트별 부가 정보 (짧은 스칼라 값만)
    properties: dict | None = None,
    # 행동 수행자(관리자면 이벤트 로그 미기록, 에러 로그만 유지)
    user: "User | None" = None,
) -> EventLog | None:
    """
    개인 식별 없이 집계용 이벤트 로그 저장.

    EventSetting에서 해당 event_type이 is_active=True일 때만 저장.
    관리자(is_staff) 사용자의 이벤트는 기록하지 않음(에러 로그만 유지).
    post_view / like / comment 이벤트는 author_user_type, author_grade_at_event 까지
    함께 저장해야 히트맵 집계가 가능합니다.

    session_id와 방문자 유형(visitor_type)은 모든 이벤트에 자동으로 채워져,
    같은 방문에서 무엇을 보고 무엇을 했는지 이어서 볼 수 있습니다.

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
        post_id=post_id,
        user_type=user_type,
        grade_at_event=grade_at_event,
        author_user_type=author_user_type,
        author_grade_at_event=author_grade_at_event,
        # 제어문자(NUL 등)는 PostgreSQL 저장 오류를 내므로 제거
        page=clean_short_text(page, 100) or None,
        search_keyword=clean_short_text(search_keyword, 100) or None,
        interest_at_event=clean_short_text(interest_at_event, 30) or None,
        session_id=(
            normalize_session_id(session_id) or get_request_session_id()
        ),
        utm_source=clean_short_text(utm_source, 50) or None,
        visitor_type=resolve_visitor_type(user),
        properties=clean_properties(properties),
    )
