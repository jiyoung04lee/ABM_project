from django.utils.crypto import get_random_string
from django.core.cache import cache


# ---------------------------------------------------------------------------
# 이메일 발송 훅 (실제 메일 발송 연결 시 여기 구현)
# ---------------------------------------------------------------------------

def send_verification_email(email: str, token: str) -> None:
    """
    이메일 인증 링크/토큰을 사용자 이메일로 발송하는 훅.
    운영 환경에서는 실제 SMTP/SendGrid 등으로 메일 발송하도록 구현.
    """
    # TODO: 실제 발송 시 인증 URL 예: f"{FRONTEND_URL}/verify-email?token={token}"
    import logging
    logger = logging.getLogger(__name__)
    logger.info(
        "[이메일 인증] email=%s, token=%s (운영에서는 메일로만 전달)",
        email, token[:8] + "...",
    )


def send_password_reset_email(email: str, token: str) -> None:
    """
    비밀번호 재설정 링크/토큰을 사용자 이메일로 발송하는 훅.
    운영 환경에서는 실제 SMTP 등으로 메일 발송하도록 구현.
    """
    import logging
    logger = logging.getLogger(__name__)
    logger.info(
        "[비밀번호 재설정] email=%s, token=%s (운영에서는 메일로만 전달)",
        email, token[:8] + "...",
    )


# ---------------------------------------------------------------------------
# 이메일 인증 토큰
# ---------------------------------------------------------------------------

def generate_email_verification_token():
    """이메일 인증 토큰 생성"""
    return get_random_string(length=32)


def store_verification_token(email, token, timeout=86400):
    """
    이메일 인증 토큰을 캐시에 저장 (기본 24시간)

    Args:
        email: 사용자 이메일
        token: 인증 토큰
        timeout: 토큰 만료 시간 (초), 기본값 86400 (24시간)
    """
    cache.set(f"email_verification_token:{token}", email, timeout=timeout)


def get_email_from_token(token):
    """
    토큰으로부터 이메일 조회

    Args:
        token: 인증 토큰

    Returns:
        이메일 주소 또는 None
    """
    return cache.get(f"email_verification_token:{token}")


def delete_verification_token(token):
    """
    인증 토큰 삭제

    Args:
        token: 인증 토큰
    """
    cache.delete(f"email_verification_token:{token}")


# ---------------------------------------------------------------------------
# 비밀번호 재설정 토큰 (캐시, TTL 30분)
# ---------------------------------------------------------------------------

PASSWORD_RESET_TOKEN_TIMEOUT = 30 * 60  # 30분


def generate_password_reset_token():
    """비밀번호 재설정용 토큰 생성"""
    return get_random_string(length=32)


def store_password_reset_token(
    email: str, token: str, timeout: int = PASSWORD_RESET_TOKEN_TIMEOUT
) -> None:
    """비밀번호 재설정 토큰을 캐시에 저장"""
    cache.set(f"password_reset_token:{token}", email, timeout=timeout)


def get_email_from_password_reset_token(token: str):
    """비밀번호 재설정 토큰으로 이메일 조회"""
    return cache.get(f"password_reset_token:{token}")


def delete_password_reset_token(token: str) -> None:
    """비밀번호 재설정 토큰 삭제"""
    cache.delete(f"password_reset_token:{token}")
