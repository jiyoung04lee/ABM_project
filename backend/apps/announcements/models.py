from django.db import models


class SiteNotice(models.Model):
    """공지 또는 배너. 메인/레이아웃에 노출."""

    TYPE_CHOICES = [
        ("banner", "배너"),
        ("notice", "공지"),
    ]

    title = models.CharField(max_length=200, verbose_name="제목")
    content = models.TextField(blank=True, verbose_name="내용")
    link = models.URLField(blank=True, verbose_name="링크 URL")
    image_url = models.URLField(blank=True, verbose_name="이미지 URL")
    notice_type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        default="notice",
        verbose_name="유형",
    )
    starts_at = models.DateTimeField(
        null=True, blank=True, verbose_name="노출 시작"
    )
    ends_at = models.DateTimeField(
        null=True, blank=True, verbose_name="노출 종료"
    )
    is_active = models.BooleanField(default=True, verbose_name="활성")
    order = models.PositiveIntegerField(default=0, verbose_name="정렬 순서")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "-created_at"]
        verbose_name = "사이트 공지/배너"
        verbose_name_plural = "사이트 공지/배너"

    def __str__(self):
        return self.title
