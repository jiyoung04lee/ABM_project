import hmac

from django.conf import settings
from django.utils.crypto import get_random_string
from django.core.cache import cache


# ---------------------------------------------------------------------------
# 소셜 온보딩 signup_token
# ---------------------------------------------------------------------------

def _signup_token_max_age() -> int:
    return int(getattr(settings, "SIGNUP_TOKEN_TIMEOUT_SEC", 600))


def generate_signup_token() -> str:
    """소셜 온보딩용 임시 토큰 생성"""
    return get_random_string(length=32)


def store_signup_token(
    user_id: int,
    token: str,
    timeout: int | None = None,
) -> None:
    """signup_token → user_id 를 캐시에 저장"""
    if timeout is None:
        timeout = _signup_token_max_age()
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


def set_onboarding_signup_cookie(response, token: str) -> None:
    """온보딩용 HttpOnly 쿠키 설정 (API 응답에 부착)."""
    name = getattr(settings, "ONBOARDING_SIGNUP_COOKIE_NAME", "onboarding_signup_token")
    response.set_cookie(
        name,
        token,
        max_age=_signup_token_max_age(),
        httponly=True,
        secure=bool(getattr(settings, "ONBOARDING_SIGNUP_COOKIE_SECURE", True)),
        samesite=getattr(settings, "ONBOARDING_SIGNUP_COOKIE_SAMESITE", "None"),
        path="/",
    )


def clear_onboarding_signup_cookie(response) -> None:
    """온보딩 쿠키 제거 (성공/만료 처리 후)."""
    name = getattr(settings, "ONBOARDING_SIGNUP_COOKIE_NAME", "onboarding_signup_token")
    samesite = getattr(settings, "ONBOARDING_SIGNUP_COOKIE_SAMESITE", "None")
    response.delete_cookie(name, path="/", samesite=samesite)


# ---------------------------------------------------------------------------
# 온보딩 nonce (더블 서브밋 CSRF 방어)
# signup_token(쿠키, HttpOnly)과 nonce(JSON→헤더)를 쌍으로 검증한다.
# ---------------------------------------------------------------------------

def generate_onboarding_nonce(signup_token: str) -> str:
    """signup_token과 쌍을 이루는 nonce를 생성·캐시에 저장."""
    nonce = get_random_string(length=32)
    cache.set(
        f"onboarding_nonce:{signup_token}",
        nonce,
        timeout=_signup_token_max_age(),
    )
    return nonce


def get_onboarding_nonce(signup_token: str) -> str | None:
    """signup_token에 연결된 nonce 조회."""
    return cache.get(f"onboarding_nonce:{signup_token}")


def verify_onboarding_nonce(signup_token: str, nonce: str) -> bool:
    """signup_token과 nonce 쌍이 일치하는지 확인 (타이밍 공격 방지)."""
    if not signup_token or not nonce:
        return False
    stored = get_onboarding_nonce(signup_token)
    if stored is None:
        return False
    return hmac.compare_digest(stored, nonce)


def delete_onboarding_nonce(signup_token: str) -> None:
    """온보딩 완료 시 nonce 삭제."""
    cache.delete(f"onboarding_nonce:{signup_token}")
