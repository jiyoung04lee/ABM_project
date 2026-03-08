from django.db import migrations

# EventSetting 초기 데이터: EventLog.EVENT_TYPE_CHOICES 기준
# event_type -> category 매핑
EVENT_CATEGORY_MAP = {
    "page_view": "navigation",
    "post_view": "content",
    "post_create": "content",
    "like": "engagement",
    "comment": "engagement",
    "signup": "authentication",
    "login": "authentication",
    "search": "discovery",
}


def seed_event_settings(apps, schema_editor):
    EventSetting = apps.get_model("logs", "EventSetting")
    for event_type, category in EVENT_CATEGORY_MAP.items():
        EventSetting.objects.get_or_create(
            event_type=event_type,
            defaults={"category": category, "is_active": True},
        )


def reverse_seed(apps, schema_editor):
    EventSetting = apps.get_model("logs", "EventSetting")
    EventSetting.objects.filter(event_type__in=EVENT_CATEGORY_MAP).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("logs", "0004_add_event_setting"),
    ]

    operations = [
        migrations.RunPython(seed_event_settings, reverse_seed),
    ]
