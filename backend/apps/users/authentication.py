"""
Custom JWT authentication.

다부전공 미승인 사용자는 Bearer 토큰이 있어도 비로그인(Anonymous)과 동일하게 취급한다.
관리자(is_staff)는 예외로 항상 인증 유지.
"""

from rest_framework_simplejwt.authentication import JWTAuthentication


class PendingAwareJWTAuthentication(JWTAuthentication):
    """
    다부전공 미승인 사용자는 인증되지 않은 것과 동일하게 처리한다.
    IsAuthenticated → 401, IsAuthenticatedOrReadOnly → 읽기만 허용.
    """

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None

        user, validated_token = result

        if getattr(user, "is_staff", False):
            return user, validated_token

        if getattr(user, "is_multi_major", False) and not getattr(
            user, "multi_major_approved", False
        ):
            return None

        return user, validated_token
