import re
from rest_framework import serializers

from .models import User, StudentRegistry
from .utils import get_user_id_from_signup_token


# ------------------------------------------------------------
# 사용자 정보
# ------------------------------------------------------------

class UserSerializer(serializers.ModelSerializer):

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
            "department",
            "bio",
            "interests",
            "profile_image",
            "personal_info_consent",
            "is_profile_complete",
            "is_verified",
            "is_staff",
            "created_at",
        )

        read_only_fields = (
            "id",
            "email",
            "is_verified",
            "is_staff",
            "created_at",
        )


# ------------------------------------------------------------
# 프로필 수정
# ------------------------------------------------------------

class UpdateProfileSerializer(serializers.ModelSerializer):

    class Meta:
        model = User
        fields = (
            "name",
            "nickname",
            "department",
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


# ------------------------------------------------------------
# 관리자 이메일/비밀번호 로그인
# ------------------------------------------------------------

class AdminLoginSerializer(serializers.Serializer):
    """관리자 전용 이메일·비밀번호 로그인 (is_staff 사용자만 허용)."""

    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
    )


# ------------------------------------------------------------
# 카카오 로그인
# ------------------------------------------------------------

class KakaoLoginInputSerializer(serializers.Serializer):
    """access_token 또는 (code + redirect_uri) 중 하나 필수."""

    access_token = serializers.CharField(required=False, allow_blank=True)
    code = serializers.CharField(required=False, allow_blank=True)
    redirect_uri = serializers.URLField(required=False, allow_blank=True)

    def validate(self, attrs):
        has_token = bool(attrs.get("access_token", "").strip())
        has_code = bool(attrs.get("code", "").strip()) and bool(
            attrs.get("redirect_uri", "").strip()
        )
        if has_token and has_code:
            attrs.pop("code", None)
            attrs.pop("redirect_uri", None)
        elif has_code:
            attrs.pop("access_token", None)
        elif has_token:
            attrs.pop("code", None)
            attrs.pop("redirect_uri", None)
        else:
            raise serializers.ValidationError(
                "access_token 또는 code+redirect_uri 를 입력해주세요."
            )
        return attrs


# ------------------------------------------------------------
# 소셜 온보딩
# ------------------------------------------------------------

class CompleteProfileSerializer(serializers.Serializer):

    signup_token = serializers.CharField()

    user_type = serializers.ChoiceField(
        choices=User.USER_TYPE_CHOICES
    )

    name = serializers.CharField(
        max_length=50,
        allow_blank=False
    )

    nickname = serializers.CharField(
        max_length=30,
        allow_blank=False
    )

    department = serializers.CharField(
        max_length=100,
        allow_blank=False
    )

    email = serializers.EmailField(required=False, allow_blank=True)

    personal_info_consent = serializers.BooleanField()

    student_id = serializers.CharField(
        max_length=8,
        required=False,
        allow_blank=True
    )

    grade = serializers.IntegerField(
        required=False
    )

    admission_year = serializers.IntegerField(
        required=False
    )

    interests = serializers.ListField(
        child=serializers.CharField(max_length=30),
        required=False,
        allow_empty=True,
    )
    is_multi_major = serializers.BooleanField(required=False, default=False)
    multi_major_image = serializers.ImageField(
        required=False,
        allow_null=True,
    )

    def validate(self, attrs):

        token = attrs["signup_token"]
        user_id = get_user_id_from_signup_token(token)

        if not user_id:
            raise serializers.ValidationError({
                "signup_token": "유효하지 않거나 만료된 토큰입니다."
            })

        attrs["_user_id"] = user_id

        if User.objects.exclude(pk=user_id).filter(
            nickname=attrs["nickname"]
        ).exists():
            raise serializers.ValidationError({
                "nickname": "이미 사용 중인 닉네임입니다."
            })

        if not attrs["personal_info_consent"]:
            raise serializers.ValidationError({
                "personal_info_consent": "개인정보 동의가 필요합니다."
            })

        email = (attrs.get("email") or "").strip()
        if email:
            if not email.endswith("@kookmin.ac.kr"):
                raise serializers.ValidationError({
                    "email": "국민대학교 이메일(@kookmin.ac.kr)만 사용할 수 있습니다."
                })
            if User.objects.exclude(pk=user_id).filter(email=email).exists():
                raise serializers.ValidationError({
                    "email": "이미 사용 중인 이메일입니다."
                })
        attrs["_email"] = email or None

        if attrs["user_type"] == "student":

            # 학과는 재학생인 경우 고정
            attrs["department"] = "AI빅데이터융합경영학과"

            student_id = (attrs.get("student_id") or "").strip()
            name = (attrs.get("name") or "").strip()

            if not student_id:
                raise serializers.ValidationError({
                    "student_id": "재학생은 학번이 필요합니다."
                })

            if not re.match(r"^\d{8}$", student_id):
                raise serializers.ValidationError({
                    "student_id": "학번은 8자리 숫자여야 합니다."
                })

            if User.objects.exclude(pk=user_id).filter(
                student_id=student_id
            ).exists():
                raise serializers.ValidationError({
                    "student_id": "이미 등록된 학번입니다."
                })

            # 학번·이름이 사전에 등록된 재학생 명단과 일치하는지 확인
            try:
                registry = StudentRegistry.objects.get(student_id=student_id)
            except StudentRegistry.DoesNotExist:
                raise serializers.ValidationError({
                    "student_id": "등록된 학번이 아닙니다. 학과에 문의해주세요."
                })

            if registry.name.strip() != name:
                raise serializers.ValidationError({
                    "name": "이름과 학번이 일치하지 않습니다. 다시 확인해주세요."
                })

            grade = attrs.get("grade")
            if grade is None or not (1 <= grade <= 4):
                raise serializers.ValidationError({
                    "grade": "학년은 1~4 사이의 값이어야 합니다."
                })

            # 다부전공생인 경우 증빙 이미지 필수
            if attrs.get("is_multi_major"):
                if not attrs.get("multi_major_image"):
                    raise serializers.ValidationError(
                        {"multi_major_image": "다부전공 인증을 위한 이미지를 업로드해주세요."}
                    )

        elif attrs["user_type"] == "graduate":

            admission_year = attrs.get("admission_year")
            if admission_year is None:
                raise serializers.ValidationError({
                    "admission_year": "졸업생은 입학년도가 필수입니다."
                })
            if not (2013 <= admission_year <= 2025):
                raise serializers.ValidationError({
                    "admission_year": "입학년도는 2013~2025 사이여야 합니다."
                })

        interests = attrs.get("interests") or []
        allowed = {"ai", "data", "business"}
        attrs["interests"] = [x for x in interests if x in allowed]

        return attrs

    def save(self):

        user = User.objects.get(pk=self.validated_data["_user_id"])

        user.user_type = self.validated_data["user_type"]
        user.name = self.validated_data["name"]
        user.nickname = self.validated_data["nickname"]
        user.department = self.validated_data["department"]
        user.email = self.validated_data.get("_email")
        user.personal_info_consent = self.validated_data[
            "personal_info_consent"
        ]
        user.interests = self.validated_data.get("interests") or []
        user.is_verified = True

        if user.user_type == User.USER_TYPE_STUDENT:
            user.student_id = self.validated_data["student_id"]
            user.grade = self.validated_data["grade"]
            user.admission_year = None
        else:
            user.admission_year = self.validated_data["admission_year"]
            user.student_id = None
            user.grade = None

        # 다부전공 여부 및 증빙 이미지
        is_multi = bool(self.validated_data.get("is_multi_major"))
        user.is_multi_major = is_multi
        if is_multi:
            image = self.validated_data.get("multi_major_image")
            if image:
                user.multi_major_image = image
            # 새로 신청한 경우 항상 승인 플래그는 False 로 초기화
            user.multi_major_approved = False

        user.is_profile_complete = user.check_profile_complete()

        user.save()

        return user
