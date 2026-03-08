from django.contrib import admin
from .models import ApiErrorLog, EventLog, EventSetting


@admin.register(EventLog)
class EventLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "event_type",
        "section",
        "page",
        "post_id",
        "user_type",
        "grade_at_event",
        "interest_at_event",
        "author_user_type",
        "author_grade_at_event",
        "search_keyword",
        "utm_source",
        "session_id",
        "created_at",
    )
    list_filter = (
        "event_type",
        "section",
        "user_type",
        "grade_at_event",
        "author_user_type",
        "author_grade_at_event",
        "utm_source",
    )
    search_fields = ("page", "utm_source", "search_keyword")
    ordering = ("-created_at",)


@admin.register(EventSetting)
class EventSettingAdmin(admin.ModelAdmin):
    list_display = ("event_type", "category", "is_active")
    list_filter = ("category", "is_active")
    list_editable = ("is_active",)


@admin.register(ApiErrorLog)
class ApiErrorLogAdmin(admin.ModelAdmin):
    list_display = ("id", "created_at", "method", "path", "status_code", "message")
    list_filter = ("status_code", "method")
    search_fields = ("path", "message")
    ordering = ("-created_at",)
    readonly_fields = ("path", "method", "status_code", "message", "created_at")