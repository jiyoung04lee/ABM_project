from django.db import models
from django.conf import settings


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
        related_name="notifications",
    )

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="acted_notifications",
        null=True,
        blank=True,
    )

    type = models.CharField(max_length=30, choices=TYPE_CHOICES)

    # 커뮤니티 게시글 / 댓글
    post = models.ForeignKey(
        "community.Post",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    comment = models.ForeignKey(
        "community.Comment",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )

    # 네트워크 게시글 / 댓글
    network_post = models.ForeignKey(
        "networks.Post",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notifications",
    )
    network_comment = models.ForeignKey(
        "networks.Comment",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notifications",
    )

    message = models.TextField(blank=True)

    is_read = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.recipient} - {self.type}"


class NewPostAlert(models.Model):
    """
    새 글 운영진 메일 알림의 발송 기록. 글 하나당 1행 (중복 발송 방지·실패 재시도용).
    발송 로직은 apps/notifications/new_post_alerts.py 참고.
    """

    BOARD_CHOICES = [
        ("community", "커뮤니티"),
        ("network", "네트워크"),
    ]

    STATUS_PENDING = "pending"
    STATUS_SENDING = "sending"
    STATUS_SENT = "sent"
    STATUS_FAILED = "failed"
    STATUS_SKIPPED = "skipped"
    STATUS_CHOICES = [
        (STATUS_PENDING, "대기"),
        (STATUS_SENDING, "발송 중"),
        (STATUS_SENT, "발송 완료"),
        (STATUS_FAILED, "실패"),
        (STATUS_SKIPPED, "건너뜀"),  # 발송 전에 글이 삭제된 경우 등
    ]

    board = models.CharField(max_length=20, choices=BOARD_CHOICES)
    post_id = models.PositiveIntegerField()
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    attempts = models.PositiveSmallIntegerField(default=0)
    last_error = models.CharField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["board", "post_id"],
                name="uniq_new_post_alert_board_post",
            ),
        ]
        indexes = [models.Index(fields=["status", "created_at"])]
        verbose_name = "새 글 메일 알림"
        verbose_name_plural = "새 글 메일 알림"

    def __str__(self):
        return f"{self.board}#{self.post_id} ({self.status})"
