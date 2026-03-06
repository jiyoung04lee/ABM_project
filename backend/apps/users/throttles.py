"""
Rate limiting (throttling) for auth-related endpoints.

- AuthThrottle (5/min per IP): kakao/login
- health, me: no throttle applied
"""
from rest_framework.throttling import ScopedRateThrottle


class AuthThrottle(ScopedRateThrottle):
    """카카오 로그인: IP 기준 분당 5회"""
    scope_attr = "throttle_scope"
    scope = "auth"
