from django.db import models


class EventLog(models.Model):

    EVENT_TYPE_CHOICES = (
        ("page_view", "페이지 방문"),
        ("post_view", "게시글 조회"),
        ("post_create", "게시글 작성"),
        ("like", "좋아요"),
        ("comment", "댓글 작성"),
        ("signup", "회원가입"),
        ("login", "로그인"),
        ("search", "검색"),
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

    # 행동 수행자(조회자) 집계 정보 (개인 식별 X)
    user_type = models.CharField(max_length=20, blank=True, null=True)
    grade_at_event = models.PositiveSmallIntegerField(blank=True, null=True)

    # 글 작성자 집계 정보 (히트맵 행(i)축 — 개인 식별 X)
    author_user_type = models.CharField(max_length=20, blank=True, null=True)
    author_grade_at_event = models.PositiveSmallIntegerField(blank=True, null=True)

    # 검색어 (search 이벤트 전용)
    search_keyword = models.CharField(max_length=100, blank=True, null=True)

    # 검색 시 행동자 관심분야 (search 이벤트 전용, ai/data/business)
    interest_at_event = models.CharField(max_length=30, blank=True, null=True)

    # 유입 경로 (instagram, qr, direct 등)
    utm_source = models.CharField(max_length=50, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    # 세션 식별 (page_view 전용, 프론트에서 방문 단위로 생성해 전달)
    session_id = models.CharField(max_length=64, blank=True, null=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["event_type", "created_at"]),
            models.Index(fields=["section", "created_at"]),
            models.Index(fields=["post_id", "event_type"]),
            models.Index(fields=["grade_at_event", "author_grade_at_event"]),
            models.Index(fields=["session_id", "created_at"]),
        ]

    def __str__(self):
        return f"{self.event_type} - {self.section} - {self.created_at}"


class EventSetting(models.Model):
    """
    이벤트 추적 ON/OFF. create_event_log 호출 시 is_active=True인 경우만 저장.
    캐시로 조회하여 매 요청 DB 접근을 줄임.
    """
    CATEGORY_CHOICES = (
        ("navigation", "Navigation"),
        ("authentication", "Authentication"),
        ("content", "Content"),
        ("engagement", "Engagement"),
        ("discovery", "Discovery"),
    )

    event_type = models.CharField(max_length=30, unique=True)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "이벤트 설정"
        verbose_name_plural = "이벤트 설정"

    def __str__(self):
        return f"{self.event_type} ({self.category})"


class ApiErrorLog(models.Model):
    """
    API 에러 모니터링용. 4xx/5xx 응답 시 미들웨어에서 저장.
    심각도(severity)는 저장하지 않고, 프론트에서 status_code로 파생.
    """
    path = models.CharField(max_length=500)
    method = models.CharField(max_length=10)
    status_code = models.PositiveSmallIntegerField()
    message = models.TextField(blank=True, default="")
    response_time_ms = models.PositiveIntegerField(
        null=True, blank=True, verbose_name="응답시간(ms)"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["created_at"]),
            models.Index(fields=["status_code"]),
        ]
        verbose_name = "API 에러 로그"
        verbose_name_plural = "API 에러 로그"

    def __str__(self):
        return f"{self.method} {self.path} {self.status_code} @ {self.created_at}"