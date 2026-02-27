from django.db import models
from django.contrib.auth.models import (
    AbstractBaseUser,
    PermissionsMixin,
    BaseUserManager,
)


class UserManager(BaseUserManager):
    """Custom user manager for email-based authentication."""

    def create_user(self, email, password=None, **extra_fields):
        """Create and return a regular user with email and password."""
        if not email:
            raise ValueError("The Email field must be set")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """Create and return a superuser with email and password."""
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_verified", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom User model with email-based authentication."""

    USER_TYPE_CHOICES = (
        ("student", "재학생"),
        ("graduate", "졸업생"),
    )

    # 기존 데이터 호환을 위해 nullable 허용 (가입 단계에서만 필수 검증)
    name = models.CharField(
        max_length=50,
        verbose_name="이름",
    )
    email = models.EmailField(unique=True, verbose_name="이메일")
    nickname = models.CharField(max_length=30, unique=True, verbose_name="닉네임")
    user_type = models.CharField(
        max_length=10,
        choices=USER_TYPE_CHOICES,
        verbose_name="사용자 유형"
    )
    student_id = models.CharField(
        max_length=8,
        blank=True,
        null=True,
        unique=True,
        verbose_name="학번"
    )
    grade = models.PositiveSmallIntegerField(
        blank=True,
        null=True,
        verbose_name="학년"
    )

    # 졸업생(graduate)의 입학년도/기수 (13~22 범위, 검증은 serializer에서 수행)
    admission_year = models.PositiveSmallIntegerField(
        blank=True,
        null=True,
        verbose_name="입학년도(기수)",
    )

    bio = models.TextField(blank=True, default="", verbose_name="자기소개")
    profile_image = models.ImageField(
        upload_to="users/profile/",
        null=True,
        blank=True,
        verbose_name="프로필 사진",
    )

    # Email verification
    is_verified = models.BooleanField(default=True, verbose_name="이메일 인증 완료")

    # Django default fields
    is_staff = models.BooleanField(default=False, verbose_name="관리자 권한")
    is_active = models.BooleanField(default=True, verbose_name="활성화")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="생성일시")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="수정일시")

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["nickname", "user_type"]

    class Meta:
        verbose_name = "사용자"
        verbose_name_plural = "사용자들"
        db_table = "users"

    def __str__(self):
        return f"{self.email}({self.nickname})"
