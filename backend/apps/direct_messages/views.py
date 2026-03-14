from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
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


class AdminBroadcastMessageView(APIView):
    """
    관리자 전용: 여러 유저에게 동일 쪽지 발송.
    POST /api/messages/admin-broadcast/
    Body: { "content": "내용" } 또는 { "content": "내용", "user_ids": [1,2,3] }
    - user_ids 생략 시: is_staff=False인 모든 유저(본인 제외)에게 발송
    - user_ids 있으면: 해당 id 유저들에게만 발송
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not request.user.is_staff:
            return Response(
                {"detail": "관리자만 사용할 수 있습니다."},
                status=status.HTTP_403_FORBIDDEN,
            )
        content = (request.data.get("content") or "").strip()
        if not content:
            return Response(
                {"detail": "content를 입력해주세요."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user_ids = request.data.get("user_ids")
        if user_ids is not None:
            try:
                target_users = list(User.objects.filter(id__in=user_ids).exclude(id=request.user.id))
            except (TypeError, ValueError):
                target_users = []
        else:
            target_users = list(
                User.objects.filter(is_staff=False).exclude(id=request.user.id)
            )
        created = 0
        for target in target_users:
            convs = Conversation.objects.filter(
                participants=request.user
            ).filter(participants=target)
            if convs.exists():
                conv = convs.first()
            else:
                conv = Conversation.objects.create()
                conv.participants.add(request.user, target)
            Message.objects.create(
                conversation=conv,
                sender=request.user,
                content=content,
            )
            created += 1
        return Response({
            "detail": f"{created}명에게 쪽지를 보냈습니다.",
            "sent_count": created,
        })


class ConversationStartViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request):
        user = request.user
        target_id = request.data.get("user_id")
    
        target_nickname = request.data.get("nickname") 
        target_user = User.objects.get(id=target_id)

        conversations = Conversation.objects.filter(
            participants=user
        ).filter(
            participants=target_user
        ).filter(
            target_nickname=target_nickname
        )

        if conversations.exists():
            conversation = conversations.first()
        else:
            conversation = Conversation.objects.create(target_nickname=target_nickname)
            conversation.participants.add(user, target_user)

        serializer = ConversationSerializer(conversation, context={"request": request})
        return Response(serializer.data)