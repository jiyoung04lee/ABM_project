from django.conf import settings


class ContentSecurityPolicyMiddleware:
    """Attach a conservative CSP for Django-served pages and API responses."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if getattr(settings, "CSP_ENABLED", True):
            response.setdefault(
                "Content-Security-Policy",
                "; ".join(getattr(settings, "CSP_POLICY", [])),
            )
        return response
