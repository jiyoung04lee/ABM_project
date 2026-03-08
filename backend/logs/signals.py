from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import EventSetting
from .utils import refresh_event_setting_cache


@receiver(post_save, sender=EventSetting)
def on_event_setting_saved(sender, instance, **kwargs):
    """EventSetting 저장 시 캐시 갱신 (API·Admin 공통)."""
    refresh_event_setting_cache()
