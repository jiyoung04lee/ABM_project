"""
집계·랭킹에서 제외할 계정의 단일 기준.

예전에는 닉네임 하드코딩(EXCLUDED_NICKNAMES)을 두 파일에 복사해 두고 있었다.
닉네임은 변경 가능해서 운영진이 닉네임을 바꾸면 조용히 집계에 다시 들어왔고,
목록이 두 곳에 있어 한쪽만 고치면 랭킹과 월간 결산이 어긋났다.
이제 User.is_operator / is_staff 플래그 하나로 판단하고, 그 규칙을 여기 모은다.
"""
from __future__ import annotations

from django.db.models import Q

# 집계 대상에서 빠지는 계정 조건
#   is_staff    : 관리자 권한 계정
#   is_operator : 관리자 권한은 없지만 통계에서 빼야 하는 운영진 계정
EXCLUDED_ACCOUNT_Q = Q(is_staff=True) | Q(is_operator=True)


def exclude_non_members(qs):
    """User 쿼리셋에서 운영자·운영진을 제외한다."""
    return qs.exclude(EXCLUDED_ACCOUNT_Q)


def excluded_user_ids() -> set[int]:
    """
    제외 대상 user_id 집합.

    DailyActiveUser처럼 User를 조인하지 않는 집계에서 쓴다.
    운영진은 십여 명 수준이라 IN 절이 작고, 호출당 쿼리 1회로 끝난다.
    """
    from .models import User

    return set(
        User.objects.filter(EXCLUDED_ACCOUNT_Q).values_list("id", flat=True)
    )


def is_excluded_account(user) -> bool:
    """단일 유저 판정. 수집 시점(create_event_log 등)에서 쓴다."""
    if user is None:
        return False
    return bool(
        getattr(user, "is_staff", False) or getattr(user, "is_operator", False)
    )
