"""
로그 수집 미들웨어.

- ErrorLoggingMiddleware: API 4xx/5xx 응답 시 ApiErrorLog에 기록.
  /api/ 경로만 대상, /api/logs/ 는 제외(에러 모니터링 API 자체 오류 무한 로깅 방지).
- DailyActiveUserMiddleware: 인증 사용자의 API 요청을 '방문'으로 기록.
"""
import json
import time


def _extract_message(response) -> str:
    """응답 본문에서 에러 메시지 추출 (최대 1000자)."""
    try:
        content = getattr(response, "content", b"")
        if isinstance(content, bytes):
            text = content.decode("utf-8", errors="replace")
        else:
            text = str(content)
        data = json.loads(text) if text.strip().startswith("{") else None
        if isinstance(data, dict):
            if "detail" in data:
                d = data["detail"]
                if isinstance(d, list):
                    return "; ".join(str(x) for x in d[:5])[:1000]
                return str(d)[:1000]
            for key in ("message", "error", "errors"):
                if key in data:
                    return str(data[key])[:1000]
        return text[:1000] if text else ""
    except Exception:
        return ""


class ErrorLoggingMiddleware:
    """
    API 에러(4xx, 5xx) 응답 시 ApiErrorLog에 한 건 저장.
    DB 오류 시에도 원래 응답은 그대로 반환.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        t_start = time.monotonic()
        response = self.get_response(request)
        elapsed_ms = int((time.monotonic() - t_start) * 1000)
        path = getattr(request, "path", "") or ""
        if not path.startswith("/api/"):
            return response
        if path.startswith("/api/logs/"):
            return response
        status = getattr(response, "status_code", 0)
        if status < 400:
            return response
        try:
            from .models import ApiErrorLog
            message = _extract_message(response)
            ApiErrorLog.objects.create(
                path=path[:500],
                method=(getattr(request, "method", "") or "GET")[:10],
                status_code=status,
                message=message,
                response_time_ms=elapsed_ms,
            )
        except Exception:
            pass
        return response


class DailyActiveUserMiddleware:
    """
    인증 사용자의 API 요청을 '방문'으로 보고 DailyActiveUser에 하루 1행 기록.

    JWT 인증이 DRF 레벨(PendingAwareJWTAuthentication)이라 요청 단계에서는
    request.user가 세션 기준 AnonymousUser다. DRF의 Request.user setter가
    밑단 HttpRequest에도 써넣으므로, 응답 단계에서 읽어야 실제 인증 사용자를
    얻을 수 있다. (ErrorLoggingMiddleware와 동일한 응답 단계 패턴)

    DRF APIView.initial()이 매 요청 perform_authentication()을 호출하므로
    모든 API 뷰에서 인증이 강제 수행되어 누락되지 않는다.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        path = getattr(request, "path", "") or ""
        if not path.startswith("/api/"):
            return response
        try:
            from .utils import record_daily_active_user

            record_daily_active_user(getattr(request, "user", None))
        except Exception:
            pass  # 집계 실패가 응답을 깨뜨리지 않도록
        return response
