from django.contrib import admin
from .models import EventLog


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
        "utm_source",
        "created_at",
    )
    list_filter = ("event_type", "section", "user_type", "grade_at_event", "utm_source")
    search_fields = ("page", "utm_source")
    ordering = ("-created_at",)