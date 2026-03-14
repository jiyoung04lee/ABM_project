from django.utils import timezone
from datetime import timedelta
from django.contrib.auth import get_user_model

from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from rest_framework.pagination import PageNumberPagination

from .models import Notification
from .serializers import NotificationSerializer

User = get_user_model()


class NotificationPagination(PageNumberPagination):
    page_size = 6
    page_size_query_param = "page_size"
    max_page_size = 20


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = NotificationPagination

    def get_queryset(self):
        # 30일 지난 알림 삭제
        thirty_days_ago = timezone.now() - timedelta(days=30)

        Notification.objects.filter(
            created_at__lt=thirty_days_ago
        ).delete()

        return Notification.objects.filter(
            recipient=self.request.user
        ).select_related("actor", "post", "comment")

    # 읽지 않은 개수
    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        count = Notification.objects.filter(
            recipient=request.user,
            is_read=False
        ).count()

        return Response({"unread_count": count})

    # 개별 읽음 처리
    @action(detail=True, methods=["patch"])
    def read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response({"status": "read"})

    # 전체 읽음 처리
    @action(detail=False, methods=["patch"])
    def read_all(self, request):
        queryset = self.get_queryset().filter(is_read=False)
        updated_count = queryset.update(is_read=True)

        return Response({
            "detail": f"{updated_count}개의 알림을 읽음 처리했습니다."
        })

    # 관리자 알림 일괄 발송
    @action(detail=False, methods=["post"], permission_classes=[IsAdminUser])
    def broadcast(self, request):
        message = request.data.get("message")
        user_ids = request.data.get("user_ids")

        if not message:
            return Response(
                {"detail": "메시지를 입력하세요."},
                status=400
            )

        if user_ids is not None:
            try:
                ids = (
                    [int(x) for x in user_ids]
                    if isinstance(user_ids, list)
                    else []
                )
            except (TypeError, ValueError):
                ids = []
            users = User.objects.filter(id__in=ids).exclude(id=request.user.id)
        else:
            users = User.objects.filter(is_staff=False).exclude(
                id=request.user.id
            )

        notifications = [
            Notification(
                recipient=user,
                type="ADMIN_NOTICE",
                message=message,
            )
            for user in users
        ]
        Notification.objects.bulk_create(notifications)

        return Response({
            "detail": "알림 발송 완료",
            "sent_count": len(notifications),
        })
