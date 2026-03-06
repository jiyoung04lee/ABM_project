from django.utils.crypto import get_random_string
from django.core.cache import cache


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
