from rest_framework import serializers
from .models import Conversation, Message
from django.contrib.auth import get_user_model

User = get_user_model()


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()

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

    def get_sender_name(self, obj):
        request = self.context.get("request")
        me = request.user
        sender = obj.sender
        conversation = obj.conversation

        # 관리자
        if getattr(sender, "is_staff", False):
            return "관리자"

        # 닉네임 채팅인 경우
        if conversation.creator_nickname and conversation.target_nickname:

            # 내가 creator인 경우
            if sender == conversation.creator:
                return conversation.creator_nickname or sender.name

            # 상대가 creator인 경우
            else:
                return conversation.target_nickname or sender.name

        # 일반 (실명)
        return sender.name


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
            "target_nickname",
        ]

    def get_other_user(self, obj):
        request = self.context.get("request")
        me = request.user
        other = obj.participants.exclude(id=me.id).first()

        if not other:
            return {"id": None, "name": "알 수 없음"}

        if getattr(other, "is_staff", False):
            return {"id": other.id, "name": "관리자"}

        # 닉네임 채팅인지 확인
        if obj.creator_nickname and obj.target_nickname:

            # 내가 creator면 상대 닉네임
            if me == obj.creator:
                nickname = obj.target_nickname

            # 내가 target이면 creator 닉네임
            else:
                nickname = obj.creator_nickname

            # ⭐ fallback
            name = nickname or obj.target_nickname or obj.creator_nickname or other.name

        else:
            name = other.name

        return {
            "id": other.id,
            "name": name,
        }

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