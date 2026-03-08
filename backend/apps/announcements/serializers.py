from rest_framework import serializers
from .models import SiteNotice


class SiteNoticeSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteNotice
        fields = [
            "id",
            "title",
            "content",
            "link",
            "image_url",
            "notice_type",
            "starts_at",
            "ends_at",
            "is_active",
            "order",
            "created_at",
            "updated_at",
        ]


class SiteNoticeCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteNotice
        fields = [
            "title",
            "content",
            "link",
            "image_url",
            "notice_type",
            "starts_at",
            "ends_at",
            "is_active",
            "order",
        ]
