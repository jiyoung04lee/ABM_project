from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model

from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer

User = get_user_model()


class ConversationViewSet(viewsets.ModelViewSet):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Conversation.objects.filter(
            participants=self.request.user
        ).order_by("-updated_at")

    def get_serializer_context(self):
        return {"request": self.request}

    @action(detail=True, methods=["get"])
    def messages(self, request, pk=None):
        conversation = self.get_object()

        messages = conversation.messages.all()

        # 상대방 메시지 자동 읽음 처리
        messages.filter(
            is_read=False
        ).exclude(
            sender=request.user
        ).update(is_read=True)

        serializer = MessageSerializer(messages, many=True)

        return Response(serializer.data)


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Message.objects.filter(
            conversation__participants=self.request.user
        )

    def perform_create(self, serializer):
        conversation = serializer.validated_data["conversation"]

        message = serializer.save(sender=self.request.user)

        # 대화 최신 시간 업데이트
        conversation.save()

    @action(detail=True, methods=["patch"])
    def read(self, request, pk=None):

        message = self.get_object()

        message.is_read = True
        message.save()

        return Response({"status": "message marked as read"})

    @action(detail=False, methods=["get"])
    def unread_count(self, request):

        count = Message.objects.filter(
            conversation__participants=request.user,
            is_read=False
        ).exclude(sender=request.user).count()

        return Response({"unread_count": count})


class ConversationStartViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request):

        user = request.user
        target_id = request.data.get("user_id")

        target_user = User.objects.get(id=target_id)

        conversations = Conversation.objects.filter(
            participants=user
        ).filter(participants=target_user)

        if conversations.exists():
            conversation = conversations.first()

        else:
            conversation = Conversation.objects.create()
            conversation.participants.add(user, target_user)

        serializer = ConversationSerializer(
            conversation,
            context={"request": request}
        )

        return Response(serializer.data)