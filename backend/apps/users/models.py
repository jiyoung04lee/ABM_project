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
    profile_image = models.ImageField(
        upload_to="users/profile/",
        null=True,
        blank=True,
        verbose_name="프로필 사진",
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
