from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.nickname", read_only=True)
    post_title = serializers.SerializerMethodField()

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
            "actor_name",
            "post_title",
            "is_read",
            "created_at",
        ]

    def get_post_title(self, obj):
        if obj.post:
            return getattr(obj.post, "title", None)
        if obj.network_post:
            return getattr(obj.network_post, "title", None)
        return None

    # 자동 메시지 생성
    def get_display_message(self, obj):
        if obj.type == "ADMIN_NOTICE":
            return f"📢 관리자 공지: {obj.message}"

        actor = obj.actor.nickname if obj.actor else "익명"

        if obj.type == "POST_LIKE":
            return f"{actor}님이 회원님의 게시글을 좋아합니다."

        if obj.type == "POST_COMMENT":
            return f"{actor}님이 회원님의 게시글에 댓글을 남겼습니다."

        if obj.type == "COMMENT_REPLY":
            return f"{actor}님이 회원님의 댓글에 답글을 남겼습니다."

        if obj.type == "COMMENT_LIKE":
            return f"{actor}님이 회원님의 댓글을 좋아합니다."

        return "새로운 알림이 있습니다."

    def get_redirect_url(self, obj):
        # 커뮤니티 댓글 관련 알림이면 댓글 위치로 이동
        if obj.comment and obj.post:
            return f"/community/{obj.post.id}#comment-{obj.comment.id}"

        # 커뮤니티 게시글 관련 알림이면 게시글로 이동
        if obj.post:
            return f"/community/{obj.post.id}"

        # 네트워크 댓글 관련 알림이면 댓글 위치로 이동
        if obj.network_comment and obj.network_post:
            return (
                f"/network/{obj.network_post.id}"
                f"#comment-{obj.network_comment.id}"
            )

        # 네트워크 게시글 관련 알림이면 게시글로 이동
        if obj.network_post:
            return f"/network/{obj.network_post.id}"

        # 관리자 공지는 공지 페이지로 이동
        if obj.type == "ADMIN_NOTICE":
            return "/notifications"

        return None
