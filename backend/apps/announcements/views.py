from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets, permissions

from .models import SiteNotice
from .serializers import SiteNoticeSerializer, SiteNoticeCreateUpdateSerializer


class SiteNoticeViewSet(viewsets.ModelViewSet):
    """
    공지/배너 CRUD. 목록·상세는 비인증 허용(활성·기간 필터).
    생성/수정/삭제는 관리자만.
    """
    queryset = SiteNotice.objects.all()

    def get_queryset(self):
        if self.action in ("list", "retrieve") and not getattr(
            self.request.user, "is_staff", False
        ):
            now = timezone.now()
            qs = SiteNotice.objects.filter(is_active=True)
            qs = qs.filter(
                Q(starts_at__isnull=True) | Q(starts_at__lte=now)
            )
            qs = qs.filter(
                Q(ends_at__isnull=True) | Q(ends_at__gte=now)
            )
            return qs.order_by("order", "-created_at")
        return SiteNotice.objects.order_by("order", "-created_at")

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return SiteNoticeCreateUpdateSerializer
        return SiteNoticeSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]