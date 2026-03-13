from __future__ import annotations

from typing import Any, Optional, Tuple
from rest_framework.request import Request
from rest_framework_simplejwt.authentication import JWTAuthentication


class CookieJWTAuthentication(JWTAuthentication):
    """
    JWT를 우선 쿠키에서 읽고, 없으면 Authorization 헤더에서 읽는 인증 클래스.

    - access 토큰 쿠키 이름: access_token
    - 헤더 기반 인증은 점진 전환을 위해 fallback 으로 남겨둔다.
    """

    def authenticate(self, request: Request) -> Optional[Tuple[Any, Any]]:
        # 1) 쿠키에서 access_token 우선 조회
        raw_token = request.COOKIES.get("access_token")

        # 2) 쿠키에 없으면 기존 헤더 방식 사용 (점진적 전환용)
        if raw_token is None:
            header = self.get_header(request)
            if header is None:
                return None
            raw_token = self.get_raw_token(header)
            if raw_token is None:
                return None

        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token
