"""
카카오 OAuth code 플로우: redirect_uri 화이트리스트 및 정규화.

카카오 개발자 콘솔에 등록한 Redirect URI와 동일한 문자열을
KAKAO_REDIRECT_URIS에 넣고, 비교 시 스킴/호스트/경로를 정규화해 일치 여부를 판단한다.
"""

from __future__ import annotations

from urllib.parse import unquote, urlparse, urlunparse

from django.conf import settings


def normalize_redirect_uri(uri: str) -> str:
    """
    OAuth redirect_uri 비교용 정규화.

    - http/https 만 허용
    - 스킴·호스트 소문자
    - 경로는 퍼센트 디코딩 후, 루트가 아니면 끝의 / 제거
    - query·fragment 제거 (redirect_uri에 붙이지 않는 것이 일반적)
    """
    raw = (uri or "").strip()
    if not raw:
        raise ValueError("redirect_uri가 비어 있습니다.")

    parsed = urlparse(raw)  # url 파싱
    scheme = (parsed.scheme or "").lower() # 스킴 소문자
    if scheme not in ("http", "https"): # 스킴이 http 또는 https 가 아니면 에러
        raise ValueError("redirect_uri는 http 또는 https 여야 합니다.")   # 허용되지 않는 스킴

    netloc = (parsed.netloc or "").lower() # 호스트 소문자
    if not netloc: # 호스트가 없으면 에러       
        raise ValueError("redirect_uri에 호스트가 없습니다.")

    path = unquote(parsed.path or "") # 경로 퍼센트 디코딩
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/") # 루트가 아니면 끝의 / 제거     

    return urlunparse((scheme, netloc, path, "", "", "")) # url 조합


def validate_kakao_redirect_uri(redirect_uri: str) -> None: # 카카오 redirect_uri 검증
    """
    settings.KAKAO_REDIRECT_URIS 화이트리스트와 일치하는지 검사.

    비교는 정규화된 값으로 한다. 카카오 토큰 API에는 클라이언트가 authorize에 쓴
    redirect_uri 문자열을 그대로 넘겨야 하므로, 이 함수는 검증만 수행한다.

    Raises:
        ValueError: 비어 있음, 형식 오류, 화이트리스트 미설정, 불일치.
    """
    allowed_raw: list[str] = getattr(settings, "KAKAO_REDIRECT_URIS", []) or [] #
    if not allowed_raw:
        raise ValueError(
            "서버에 허용된 카카오 redirect URI(KAKAO_REDIRECT_URIS)가 설정되어 있지 않습니다."
        )

    normalized = normalize_redirect_uri(redirect_uri) # 클라이언트 uri 정규화 

    allowed_normalized = set()
    for entry in allowed_raw:
        try:
            allowed_normalized.add(normalize_redirect_uri(entry))
        except ValueError as e:
            raise ValueError(
                f"서버 설정 KAKAO_REDIRECT_URIS 항목이 올바르지 않습니다: {entry!r} ({e})"
            ) from e

    if normalized not in allowed_normalized:
        raise ValueError("허용되지 않은 redirect_uri입니다.")
