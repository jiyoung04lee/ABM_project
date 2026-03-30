"""
Custom JWT authentication.

쿠키(access_token) 또는 Authorization 헤더 둘 다 지원.
다부전공 미승인 사용자는 비로그인과 동일하게 취급.
관리자(is_staff)는 항상 인증 유지.
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from django.conf import settings


class PendingAwareJWTAuthentication(JWTAuthentication):
    """
    1. 쿠키(access_token)에서 JWT를 먼저 읽음
    2. 없으면 Authorization 헤더에서 읽음 (하위 호환)
    3. 다부전공 미승인 사용자는 비로그인 처리
    """

    def authenticate(self, request):
        # 1) 쿠키에서 먼저 시도
        cookie_name = getattr(settings, "JWT_ACCESS_COOKIE", "access_token")
        raw_token = request.COOKIES.get(cookie_name)

        if raw_token:
            try:
                validated_token = self.get_validated_token(raw_token)
                user = self.get_user(validated_token)
                return self._check_user(user, validated_token)
            except Exception:
                pass  # 쿠키 토큰 만료 시 헤더로 폴백

        # 2) Authorization 헤더에서 시도 (기존 방식)
        result = super().authenticate(request)
        if result is None:
            return None

        user, validated_token = result
        return self._check_user(user, validated_token)

    def _check_user(self, user, validated_token):
        if getattr(user, "is_staff", False):
            return user, validated_token

        if getattr(user, "is_multi_major", False) and not getattr(
            user, "multi_major_approved", False
        ):
            return None

        return user, validated_token