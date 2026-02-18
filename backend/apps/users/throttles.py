"""
Rate limiting (throttling) for auth-related endpoints.

- AuthThrottle (5/min per IP): register, login, verify-email
- PasswordResetThrottle (3/min per IP): password-reset/request, confirm
- health, me: no throttle applied
"""
from rest_framework.throttling import ScopedRateThrottle


class AuthThrottle(ScopedRateThrottle):
    """회원가입 / 로그인 / 이메일 인증: IP 기준 분당 5회"""
    scope_attr = "throttle_scope"
    scope = "auth"


class PasswordResetThrottle(ScopedRateThrottle):
    """비밀번호 재설정 요청·확인: IP 기준 분당 3회"""
    scope_attr = "throttle_scope"
    scope = "password_reset"
