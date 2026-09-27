from django.core.cache import cache
from django.db import migrations

# 0단계에 추가된 이벤트 (create_event_log는 EventSetting이 활성인 타입만 저장)
NEW_EVENT_CATEGORY_MAP = {
    "login_wall_view": "authentication",
    "write_start": "content",
    "draft_save": "content",
}

# logs.utils.CACHE_KEY_ACTIVE_EVENT_TYPES — 활성 이벤트 집합 캐시(24시간).
# 마이그레이션은 post_save 시그널을 타지 않으므로 직접 비워야 새 이벤트가 바로 저장된다.
ACTIVE_EVENT_TYPES_CACHE_KEY = "logs:event_setting:active_set"


def seed_new_event_settings(apps, schema_editor):
    EventSetting = apps.get_model("logs", "EventSetting")
    for event_type, category in NEW_EVENT_CATEGORY_MAP.items():
        EventSetting.objects.get_or_create(
            event_type=event_type,
            defaults={"category": category, "is_active": True},
        )
    cache.delete(ACTIVE_EVENT_TYPES_CACHE_KEY)


def reverse_seed(apps, schema_editor):
    EventSetting = apps.get_model("logs", "EventSetting")
    EventSetting.objects.filter(event_type__in=NEW_EVENT_CATEGORY_MAP).delete()
    cache.delete(ACTIVE_EVENT_TYPES_CACHE_KEY)


class Migration(migrations.Migration):

    dependencies = [
        ("logs", "0010_eventlog_visitor_type_properties"),
    ]

    operations = [
        migrations.RunPython(seed_new_event_settings, reverse_seed),
    ]
