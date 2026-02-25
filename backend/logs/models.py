from django.db import models


class EventLog(models.Model):

    EVENT_TYPE_CHOICES = (
        ("page_view", "페이지 방문"),
        ("post_view", "게시글 조회"),
        ("like", "좋아요"),
        ("comment", "댓글 작성"),
        ("signup", "회원가입"),
        ("login", "로그인"),
    )

    SECTION_CHOICES = (
        ("home", "홈"),
        ("community", "커뮤니티"),
        ("network", "네트워크"),
        ("department", "학과정보"),
    )

    event_type = models.CharField(max_length=30, choices=EVENT_TYPE_CHOICES)

    # 어떤 영역(게시판)에서 발생했는지
    section = models.CharField(
        max_length=50,
        choices=SECTION_CHOICES,
        blank=True,
        null=True
    )

    # 어떤 페이지인지
    page = models.CharField(max_length=100, blank=True, null=True)

    # 어떤 게시글인지
    post_id = models.IntegerField(blank=True, null=True)

    # 집계용 정보 (개인 식별 X)
    user_type = models.CharField(max_length=20, blank=True, null=True)
    grade_at_event = models.IntegerField(blank=True, null=True)

    # 유입 경로 (instagram, qr, direct 등)
    utm_source = models.CharField(max_length=50, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.event_type} - {self.section} - {self.created_at}"