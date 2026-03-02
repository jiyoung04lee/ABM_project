from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):

    actor_name = serializers.CharField(source="actor.nickname", read_only=True)
    post_title = serializers.CharField(source="post.title", read_only=True)

    # 이동용 URL
    redirect_url = serializers.SerializerMethodField()
    display_message = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "type",
            "display_message",  
            "redirect_url",
            "is_read",
            "created_at",
        ]

    # 자동 메시지 생성 
    def get_display_message(self, obj):

        actor = obj.actor.nickname if obj.actor else "관리자"

        if obj.type == "POST_LIKE":
            return f"{actor}님이 회원님의 게시글을 좋아합니다."

        if obj.type == "POST_COMMENT":
            return f"{actor}님이 회원님의 게시글에 댓글을 남겼습니다."

        if obj.type == "COMMENT_REPLY":
            return f"{actor}님이 회원님의 댓글에 답글을 남겼습니다."

        if obj.type == "COMMENT_LIKE":
            return f"{actor}님이 회원님의 댓글을 좋아합니다."

        if obj.type == "ADMIN_NOTICE":
            return f"📢 관리자 공지: {obj.message}"

        return "새로운 알림이 있습니다."

    def get_redirect_url(self, obj):

        # 댓글 관련 알림이면 댓글 위치로 이동
        if obj.comment and obj.post:
            return f"/community/{obj.post.id}#comment-{obj.comment.id}"

        # 게시글 관련 알림이면 게시글로 이동
        if obj.post:
            return f"/community/{obj.post.id}"

        # 관리자 공지는 공지 페이지로 이동 
        if obj.type == "ADMIN_NOTICE":
            return "/notifications"

        return None