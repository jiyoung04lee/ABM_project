from rest_framework import serializers
from .models import Conversation, Message
from django.contrib.auth import get_user_model

User = get_user_model()


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.username", read_only=True)

    class Meta:
        model = Message
        fields = [
            "id",
            "conversation",
            "sender",
            "sender_name",
            "content",
            "is_read",
            "created_at",
        ]
        read_only_fields = ["sender", "is_read"]


class ConversationSerializer(serializers.ModelSerializer):
    other_user = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    last_message_time = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id",
            "other_user",
            "created_at",
            "updated_at",
            "last_message",
            "last_message_time",
            "unread_count",
        ]

    def get_other_user(self, obj):
        request = self.context.get("request")
        user = request.user

        other = obj.participants.exclude(id=user.id).first()

        if other:
            return {
                "id": other.id,
                "name": other.name
            }
        return None

    def get_last_message(self, obj):
        last = obj.messages.last()
        if last:
            return last.content
        return None

    def get_last_message_time(self, obj):
        last = obj.messages.last()
        if last:
            return last.created_at
        return None

    def get_unread_count(self, obj):
        request = self.context.get("request")

        return obj.messages.filter(
            is_read=False
        ).exclude(
            sender=request.user
        ).count()