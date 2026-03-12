from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.utils.crypto import get_random_string
from rest_framework.response import Response


# ---------------------------------------------------------------------------
# 소셜 온보딩 signup_token
# ---------------------------------------------------------------------------

SIGNUP_TOKEN_TIMEOUT = 10 * 60  # 10분


def generate_signup_token() -> str:
    """소셜 온보딩용 임시 토큰 생성"""
    return get_random_string(length=32)


def store_signup_token(
    user_id: int,
    token: str,
    timeout: int = SIGNUP_TOKEN_TIMEOUT,
) -> None:
    """signup_token → user_id 를 캐시에 저장"""
    cache.set(f"signup_token:{token}", user_id, timeout=timeout)


def generate_and_store_signup_token(user_id: int) -> str:
    """signup_token 생성 + 저장을 한 번에 수행"""
    token = generate_signup_token()
    store_signup_token(user_id=user_id, token=token)
    return token


def get_user_id_from_signup_token(token: str):
    """signup_token으로 user_id 조회 (없으면 None)"""
    return cache.get(f"signup_token:{token}")


def get_user_from_signup_token(token: str):
    """signup_token으로 User 객체 조회 (없으면 None)"""
    user_id = get_user_id_from_signup_token(token)
    if not user_id:
        return None

    from .models import User
    return User.objects.filter(pk=user_id).first()


def delete_signup_token(token: str) -> None:
    """signup_token 삭제"""
    cache.delete(f"signup_token:{token}")


# ---------------------------------------------------------------------------
# JWT 쿠키 헬퍼
# ---------------------------------------------------------------------------


def _get_max_age(delta: timedelta) -> int:
    return int(delta.total_seconds())


def set_jwt_cookies(response: Response, access: str, refresh: str) -> None:
    """
    access/refresh 토큰을 HttpOnly 쿠키로 설정.
    - 개발환경(DEBUG=True): SameSite=Lax, Secure=False
    - 운영환경(DEBUG=False): SameSite=None, Secure=True (HTTPS 전제)
    """

    access_lifetime: timedelta = settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"]
    refresh_lifetime: timedelta = settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]

    secure = not settings.DEBUG
    samesite = "None" if not settings.DEBUG else "Lax"

    response.set_cookie(
        "access_token",
        access,
        max_age=_get_max_age(access_lifetime),
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/",
    )
    response.set_cookie(
        "refresh_token",
        refresh,
        max_age=_get_max_age(refresh_lifetime),
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/",
    )


def clear_jwt_cookies(response: Response) -> Response:
    """JWT 관련 쿠키 삭제"""
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return response
