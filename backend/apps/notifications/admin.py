from django.contrib import admin

# Register your models here.
from .models import Notification

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "recipient", "type", "is_read", "created_at")
    list_filter = ("type", "is_read")