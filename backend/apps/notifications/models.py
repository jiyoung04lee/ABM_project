from django.db import models
from django.conf import settings

# Create your models here.
class Notification(models.Model):

    TYPE_CHOICES = [
        ("POST_LIKE", "게시글 좋아요"),
        ("POST_COMMENT", "게시글 댓글"),
        ("COMMENT_LIKE", "댓글 좋아요"),
        ("COMMENT_REPLY", "대댓글"),
        ("ADMIN_NOTICE", "관리자 공지"),
    ]

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications"
    )

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="acted_notifications",
        null=True,
        blank=True
    )

    type = models.CharField(max_length=30, choices=TYPE_CHOICES)

    post = models.ForeignKey(
        "community.Post",
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )

    comment = models.ForeignKey(
        "community.Comment",
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )

    message = models.TextField(blank=True)

    is_read = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.recipient} - {self.type}"