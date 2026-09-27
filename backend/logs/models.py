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
        ("login_wall_view", "로그인 요구 화면"),
        ("write_start", "글쓰기 시작"),
        ("draft_save", "임시저장"),
    )

    # 행동 시점의 방문자 유형 (utils.resolve_visitor_type 참고)
    VISITOR_TYPE_CHOICES = (
        ("guest", "비로그인"),
        ("new", "신규 회원"),
        ("member", "기존 회원"),
        ("returning", "휴면 복귀 회원"),
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

    # 세션 식별 (프론트에서 방문 단위로 생성, X-Session-Id 헤더로 모든 이벤트에 전달)
    session_id = models.CharField(max_length=64, blank=True, null=True, db_index=True)

    # 행동 시점의 방문자 유형 (개인 식별 X)
    visitor_type = models.CharField(
        max_length=20,
        choices=VISITOR_TYPE_CHOICES,
        blank=True,
        null=True,
    )

    # 이벤트별 부가 정보 (로그인 요구 사유, 유입 referrer 등). 짧은 값만 저장.
    # db_default: 배포 중·롤백 시 이 컬럼을 모르는 이전 코드의 INSERT도 실패하지 않도록
    properties = models.JSONField(
        default=dict,
        db_default=models.Value({}, output_field=models.JSONField()),
        blank=True,
    )

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


class DailyActiveUser(models.Model):
    """
    인증 사용자의 일별 활성 기록. user당 하루 최대 1행.

    DAU / WAU / MAU · 재방문율 · 주간 유지율 전용.
    EventLog(개인 식별 X)와 의도적으로 분리 — 개인 식별 정보는 이 테이블에만 존재한다.
    EventSetting ON/OFF 대상이 아니다(page_view를 꺼도 DAU는 계속 쌓여야 함).

    date는 settings.ANALYTICS_TIME_ZONE(기본값 = TIME_ZONE = Asia/Seoul) 기준 날짜.
    DateField에 날짜를 직접 저장하므로, 저장 시점의 기준 타임존이 곧 집계 기준이다.
    """

    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="active_days",
    )
    date = models.DateField(verbose_name="활성 일자(KST)")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "date"],
                name="uniq_daily_active_user_user_date",
            ),
        ]
        indexes = [models.Index(fields=["date"])]
        verbose_name = "일별 활성 사용자"
        verbose_name_plural = "일별 활성 사용자"

    def __str__(self):
        return f"user={self.user_id} @ {self.date}"


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