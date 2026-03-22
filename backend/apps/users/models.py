from django.db import models
from django.contrib.auth.models import (
    AbstractBaseUser,
    PermissionsMixin,
    BaseUserManager,
)


class UserManager(BaseUserManager):
    """Custom user manager for email-based authentication."""

    def create_user(self, email, password=None, **extra_fields):
        """Create and return a regular user."""
        if not email:
            raise ValueError("The Email field must be set")

        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)

        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()

        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """Create and return a superuser."""
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_verified", True)
        extra_fields.setdefault("is_profile_complete", True)
        extra_fields.setdefault("personal_info_consent", True)
        extra_fields.setdefault("social_provider", "email")

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom User: email or social (e.g. Kakao) login."""

    USER_TYPE_STUDENT = "student"
    USER_TYPE_GRADUATE = "graduate"

    USER_TYPE_CHOICES = (
        (USER_TYPE_STUDENT, "재학생"),
        (USER_TYPE_GRADUATE, "졸업생"),
    )

    SOCIAL_PROVIDER_EMAIL = "email"
    SOCIAL_PROVIDER_KAKAO = "kakao"

    SOCIAL_PROVIDER_CHOICES = (
        (SOCIAL_PROVIDER_EMAIL, "Email"),
        (SOCIAL_PROVIDER_KAKAO, "Kakao"),
    )

    # 기본 정보
    name = models.CharField(
        max_length=50,
        verbose_name="이름",
    )
    email = models.EmailField(
        unique=True,
        null=True,
        blank=True,
        verbose_name="이메일",
    )
    email_encrypted = models.TextField(
        blank=True,
        null=True,
        verbose_name="이메일(암호화)",
    )
    email_hash = models.CharField(
        max_length=64,
        blank=True,
        null=True,
        db_index=True,
        verbose_name="이메일 해시",
    )
    nickname = models.CharField(
        max_length=30,
        unique=True,
        verbose_name="닉네임",
    )

    # 사용자 유형
    user_type = models.CharField(
        max_length=10,
        choices=USER_TYPE_CHOICES,
        blank=True,
        default="",
        verbose_name="사용자 유형",
    )

    # 재학생 정보
    student_id = models.CharField(
        max_length=8,
        blank=True,
        null=True,
        unique=True,
        verbose_name="학번",
    )
    student_id_encrypted = models.TextField(
        blank=True,
        null=True,
        verbose_name="학번(암호화)",
    )
    student_id_hash = models.CharField(
        max_length=64,
        blank=True,
        null=True,
        db_index=True,
        verbose_name="학번 해시",
    )
    grade = models.PositiveSmallIntegerField(
        blank=True,
        null=True,
        verbose_name="학년",
    )

    # 졸업생 정보
    admission_year = models.PositiveSmallIntegerField(
        blank=True,
        null=True,
        verbose_name="입학년도(기수)",
    )

    # 프로필
    department = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="학과",
    )
    bio = models.TextField(
        blank=True,
        default="",
        verbose_name="자기소개",
    )
    interests = models.JSONField(
        default=list,
        blank=True,
        verbose_name="관심분야",
        help_text="예: ['ai', 'data', 'business']",
    )
    profile_image = models.ImageField(
        upload_to="users/profile/",
        null=True,
        blank=True,
        verbose_name="프로필 사진",
    )

    # 1전공 학과명 (다부전공생 전용)
    primary_major = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="1전공 학과명",
    )

    # 다부전공/복수전공 인증 정보
    is_multi_major = models.BooleanField(
        default=False,  # type: ignore[reportArgumentType]
        verbose_name="다부전공 여부",
    )
    multi_major_image = models.ImageField(
        upload_to="users/multi_major/",
        null=True,
        blank=True,
        verbose_name="다부전공 증빙 이미지",
    )
    multi_major_approved = models.BooleanField(
        default=False,  # type: ignore[reportArgumentType]
        verbose_name="다부전공 승인 여부",
    )

    # 소셜 로그인
    social_provider = models.CharField(
        max_length=20,
        choices=SOCIAL_PROVIDER_CHOICES,
        default=SOCIAL_PROVIDER_EMAIL,
        verbose_name="소셜 제공자",
    )
    kakao_id = models.CharField(
        max_length=64,
        unique=True,
        null=True,
        blank=True,
        verbose_name="카카오 ID",
    )

    # 동의/온보딩
    personal_info_consent = models.BooleanField(
        default=False,  # type: ignore[reportArgumentType]
        verbose_name="개인정보 수집·이용 동의",
    )
    is_profile_complete = models.BooleanField(
        default=False,  # type: ignore[reportArgumentType]
        verbose_name="온보딩 완료 여부",
    )

    # 인증/권한
    is_verified = models.BooleanField(
        default=False,  # type: ignore[reportArgumentType]
        verbose_name="인증 완료",
    )
    is_staff = models.BooleanField(
        default=False,  # type: ignore[reportArgumentType]
        verbose_name="관리자 권한",
    )
    is_active = models.BooleanField(
        default=True,  # type: ignore[reportArgumentType]
        verbose_name="활성화",
    )

    # 타임스탬프
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="생성일시",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="수정일시",
    )

    # 활동 점수 시스템
    score = models.PositiveIntegerField(
        default=0,
        verbose_name="활동 점수",
    )

    last_login_point_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="로그인 점수 마지막 지급일",
    )

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["nickname"]

    class Meta:
        verbose_name = "사용자"
        verbose_name_plural = "사용자들"
        db_table = "users"

    def __str__(self):
        return f"{self.email}({self.nickname})"

    @property
    def is_social_user(self):
        return self.social_provider != self.SOCIAL_PROVIDER_EMAIL

    def check_profile_complete(self):
        """현재 유저 정보 기준으로 온보딩 완료 여부를 계산."""
        if not self.nickname:
            return False

        if not self.department:
            return False

        if not self.personal_info_consent:
            return False

        if self.user_type == self.USER_TYPE_STUDENT:
            return bool(self.student_id and self.grade)

        if self.user_type == self.USER_TYPE_GRADUATE:
            return bool(self.admission_year)

        return False
    

    # 레벨 계산
    @property
    def level(self):
        level = self.score // 30 + 1
        return min(level, 10)


class StudentRegistry(models.Model):
    """학번·이름 대조용 재학생 명단."""

    student_id = models.CharField(
        max_length=8, 
        unique=True, 
        verbose_name="학번",
    )
    student_id_encrypted = models.TextField(
        blank=True, 
        null=True, 
        verbose_name="학번(암호화)",
    )
    student_id_hash = models.CharField(
        max_length=64, 
        blank=True, 
        null=True, 
        db_index=True, 
        verbose_name="학번 해시",
    )
    name = models.CharField(
        max_length=50, 
        verbose_name="이름",
    )
    name_encrypted = models.TextField(
        blank=True, 
        null=True, 
        verbose_name="이름(암호화)",
    )
    name_hash = models.CharField(
        max_length=64, 
        blank=True, 
        null=True, 
        db_index=True, 
        verbose_name="이름 해시",
    )

    class Meta:
        verbose_name = "재학생 명부"
        verbose_name_plural = "재학생 명부"

    def __str__(self) -> str:
        return f"{self.student_id} - {self.name}"
    

class ScoreHistory(models.Model):

    SCORE_TYPE_CHOICES = (
        ("post_like", "게시글 좋아요"),
        ("comment_like", "댓글 좋아요"),
    )

    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="score_histories",
    )

    score_type = models.CharField(
        max_length=20,
        choices=SCORE_TYPE_CHOICES,
    )

    target_id = models.IntegerField()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "score_type", "target_id")
        indexes = [
            models.Index(fields=["user", "score_type"]),
        ]
