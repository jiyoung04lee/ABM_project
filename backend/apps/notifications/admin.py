from django.contrib import admin

# Register your models here.
from .models import NewPostAlert, Notification

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "recipient", "type", "is_read", "created_at")
    list_filter = ("type", "is_read")


@admin.register(NewPostAlert)
class NewPostAlertAdmin(admin.ModelAdmin):
    """새 글 메일 알림 발송 기록 (조회 전용)."""

    list_display = ("id", "board", "post_id", "status", "attempts", "created_at", "sent_at")
    list_filter = ("board", "status")
    readonly_fields = (
        "board", "post_id", "status", "attempts", "last_error",
        "created_at", "updated_at", "sent_at",
    )

    def has_add_permission(self, request):
        return False
