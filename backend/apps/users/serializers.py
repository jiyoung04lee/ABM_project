import re
from rest_framework import serializers
from django.contrib.auth import authenticate
from django.core.cache import cache

from .models import User
from .utils import get_email_from_password_reset_token


class RegisterSerializer(serializers.ModelSerializer):
    """회원가입 Serializer"""

    name = serializers.CharField(required=True, allow_blank=False)

    password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={"input_type": "password"},
        help_text="비밀번호 (최소 8자)"
    )
    password_confirm = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
        help_text="비밀번호 확인"
    )

    class Meta:
        model = User
        fields = (
            "email",
            "name",
            "nickname",
            "password",
            "password_confirm",
            "user_type",
            "student_id",
            "grade",
            "admission_year",
        )

    def validate_email(self, value):
        """이메일 중복 검증"""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("이미 사용 중인 이메일입니다.")
        return value

    def validate_nickname(self, value):
        """닉네임 중복 검증"""
        if User.objects.filter(nickname=value).exists():
            raise serializers.ValidationError("이미 사용 중인 닉네임입니다.")
        return value

    def validate_student_id(self, value):
        """학번 중복 검증 (값이 있을 때만)"""
        if value and User.objects.filter(student_id=value).exists():
            raise serializers.ValidationError("이미 등록된 학번입니다.")
        return value

    def validate(self, attrs):
        """전체 필드 검증"""
        password = attrs.get("password")
        password_confirm = attrs.get("password_confirm")
        user_type = attrs.get("user_type")
        email = attrs.get("email")
        student_id = attrs.get("student_id")
        grade = attrs.get("grade")
        admission_year = attrs.get("admission_year")

        # 비밀번호 확인 검증
        if password != password_confirm:
            raise serializers.ValidationError({
                "password_confirm": "비밀번호가 일치하지 않습니다."
            })

        # 재학생(student) 검증
        if user_type == "student":
            # student_id 필수 및 8자리 숫자 검증
            if not student_id:
                raise serializers.ValidationError({
                    "student_id": "재학생은 학번이 필수입니다."
                })
            if not re.match(r"^\d{8}$", student_id):
                raise serializers.ValidationError({
                    "student_id": "학번은 8자리 숫자여야 합니다."
                })

            # grade 필수 및 범위 검증 (1~4)
            if grade is None:
                raise serializers.ValidationError({
                    "grade": "재학생은 학년이 필수입니다."
                })
            if not (1 <= grade <= 4):
                raise serializers.ValidationError({
                    "grade": "학년은 1~4 사이의 값이어야 합니다."
                })

            # 재학생 admission_year (있을 경우만 13~22 범위 검증)
            if admission_year is not None and not (13 <= admission_year <= 22):
                raise serializers.ValidationError({
                    "admission_year": "입학년도는 13~22 사이의 값이어야 합니다."
                })

        # 졸업생(graduate) 검증
        elif user_type == "graduate":
            # admission_year 필수 + 13~22 범위
            if admission_year is None:
                raise serializers.ValidationError({
                    "admission_year": "졸업생은 입학년도(기수)가 필수입니다."
                })
            if not (13 <= admission_year <= 22):
                raise serializers.ValidationError({
                    "admission_year": "입학년도는 13~22 사이의 값이어야 합니다."
                })

            # grade가 제공된 경우 범위 검증 (optional)
            if grade is not None and not (1 <= grade <= 4):
                raise serializers.ValidationError({
                    "grade": "학년은 1~4 사이의 값이어야 합니다."
                })

        # password_confirm은 저장하지 않으므로 제거
        attrs.pop("password_confirm", None)
        return attrs

    def create(self, validated_data):
        """사용자 생성"""
        password = validated_data.pop("password")
        user = User.objects.create_user(password=password, **validated_data)
        return user


class LoginSerializer(serializers.Serializer):
    """로그인 Serializer"""

    email = serializers.EmailField(help_text="이메일")
    password = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
        help_text="비밀번호"
    )

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        if email and password:
            # email을 username으로 사용 (USERNAME_FIELD가 email)
            user = authenticate(
                request=self.context.get("request"),
                username=email,
                password=password,
            )

            if not user:
                raise serializers.ValidationError("이메일 또는 비밀번호가 올바르지 않습니다.")

            if not user.is_active:
                raise serializers.ValidationError("비활성화된 계정입니다.")

            attrs["user"] = user
        else:
            raise serializers.ValidationError("이메일과 비밀번호를 모두 입력해주세요.")

        return attrs


class UserSerializer(serializers.ModelSerializer):
    """사용자 정보 Serializer"""

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "name",
            "nickname",
            "user_type",
            "student_id",
            "grade",
            "admission_year",
            "bio",
            "profile_image",
            "is_verified",
            "created_at",
        )
        read_only_fields = ("id", "email", "is_verified", "created_at")


class EmailVerificationSerializer(serializers.Serializer):
    """이메일 인증 Serializer"""

    token = serializers.CharField(help_text="이메일 인증 토큰")

    def validate_token(self, value):
        """토큰 유효성 검증"""
        email = cache.get(f"email_verification_token:{value}")
        if not email:
            raise serializers.ValidationError("유효하지 않거나 만료된 인증 토큰입니다.")
        return value

    def validate(self, attrs):
        token = attrs.get("token")
        email = cache.get(f"email_verification_token:{token}")

        if not email:
            raise serializers.ValidationError({
                "token": "유효하지 않거나 만료된 인증 토큰입니다."
            })

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError({
                "token": "해당 이메일로 가입된 사용자를 찾을 수 없습니다."
            })

        if user.is_verified:
            raise serializers.ValidationError({
                "token": "이미 인증된 이메일입니다."
            })

        attrs["user"] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    """비밀번호 변경 Serializer (로그인 상태)"""

    current_password = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
        help_text="현재 비밀번호"
    )
    new_password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={"input_type": "password"},
        help_text="새 비밀번호 (최소 8자)"
    )
    new_password_confirm = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
        help_text="새 비밀번호 확인"
    )

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError({
                "current_password": "현재 비밀번호가 올바르지 않습니다."
            })
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError({
                "new_password_confirm": "새 비밀번호가 일치하지 않습니다."
            })
        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    """비밀번호 재설정 요청 (이메일 입력)"""

    email = serializers.EmailField(help_text="가입 시 사용한 이메일")

    def validate_email(self, value):
        # 존재 여부는 validate()에서만 사용, 동일 응답으로 보안 유지
        return value

    def validate(self, attrs):
        email = attrs.get("email")
        try:
            attrs["user"] = User.objects.get(email=email)
        except User.DoesNotExist:
            attrs["user"] = None
        return attrs


class PasswordResetConfirmSerializer(serializers.Serializer):
    """비밀번호 재설정 확인 (토큰 + 새 비밀번호)"""

    token = serializers.CharField(help_text="비밀번호 재설정 토큰")
    new_password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={"input_type": "password"},
        help_text="새 비밀번호 (최소 8자)",
    )
    new_password_confirm = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
        help_text="새 비밀번호 확인",
    )

    def validate_token(self, value):
        email = get_email_from_password_reset_token(value)
        if not email:
            raise serializers.ValidationError("유효하지 않거나 만료된 토큰입니다.")
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError({
                "new_password_confirm": "비밀번호가 일치하지 않습니다.",
            })
        token = attrs["token"]
        email = get_email_from_password_reset_token(token)
        if not email:
            raise serializers.ValidationError({"token": "유효하지 않거나 만료된 토큰입니다."})
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError({"token": "해당 사용자를 찾을 수 없습니다."})
        attrs["user"] = user
        return attrs


class UpdateProfileSerializer(serializers.ModelSerializer):
    """프로필 수정 Serializer (PATCH /api/users/me/)"""

    class Meta:
        model = User
        fields = (
            "name",
            "nickname",
            "bio",
            "profile_image",
            "grade",
            "student_id",
            "admission_year",
        )

    def validate_nickname(self, value):
        user = self.context["request"].user
        if User.objects.exclude(pk=user.pk).filter(nickname=value).exists():
            raise serializers.ValidationError("이미 사용 중인 닉네임입니다.")
        return value

    def validate_student_id(self, value):
        if not value:
            return value
        user = self.context["request"].user
        if User.objects.exclude(pk=user.pk).filter(student_id=value).exists():
            raise serializers.ValidationError("이미 등록된 학번입니다.")
        return value

    def validate(self, attrs):
        user = self.context["request"].user
        user_type = user.user_type

        grade = attrs.get("grade", getattr(user, "grade", None))
        student_id = attrs.get("student_id", getattr(user, "student_id", None))
        admission_year = attrs.get("admission_year", getattr(user, "admission_year", None))

        if user_type == "student":
            if grade is not None and not (1 <= grade <= 4):
                raise serializers.ValidationError({"grade": "학년은 1~4 사이의 값이어야 합니다."})
            if student_id and not re.match(r"^\d{8}$", student_id):
                raise serializers.ValidationError({"student_id": "학번은 8자리 숫자여야 합니다."})
            attrs.pop("admission_year", None)

        elif user_type == "graduate":
            if admission_year is not None and not (13 <= admission_year <= 25):
                raise serializers.ValidationError({"admission_year": "입학년도는 13~25 사이의 값이어야 합니다."})
            attrs.pop("grade", None)
            attrs.pop("student_id", None)

        return attrs
