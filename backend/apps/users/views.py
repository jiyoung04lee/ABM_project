import requests
from typing import Any, cast
from django.conf import settings
from django.contrib.auth import authenticate
from django.http import JsonResponse
from django.utils.crypto import get_random_string
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.tokens import RefreshToken

from logs.utils import create_event_log

from .models import User
from .serializers import (
    UserSerializer,
    UpdateProfileSerializer,
    KakaoLoginInputSerializer,
    CompleteProfileSerializer,
    AdminLoginSerializer,
)
from .throttles import AuthThrottle
from .utils import (
    clear_jwt_cookies,
    delete_signup_token,
    generate_and_store_signup_token,
    set_jwt_cookies,
)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def health_check(request):
    """
    간단한 헬스체크용 API.
    프론트에서 백엔드 서버 살아있는지 확인할 때 사용.
    """
    return JsonResponse({"status": "ok"})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def admin_info(request):
    """
    GET /api/users/admin-info/
    첫 번째 staff 유저의 id·name·nickname 반환.
    일반 사용자가 관리자에게 쪽지를 보낼 때 사용.
    """
    admin_user = User.objects.filter(is_staff=True).order_by("id").first()
    if not admin_user:
        return JsonResponse({"detail": "관리자가 없습니다."}, status=404)
    return JsonResponse({
        "id": admin_user.id,
        "name": admin_user.name or admin_user.nickname or "관리자",
        "nickname": admin_user.nickname or "관리자",
    })


class MeView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/users/me/    - 내 정보 조회
    PATCH /api/users/me/   - 프로필 수정
    """
    permission_classes = [permissions.IsAuthenticated]

    parser_classes = [MultiPartParser, FormParser]

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return UpdateProfileSerializer
        return UserSerializer

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return super().update(request, *args, **kwargs)


class LogoutView(generics.GenericAPIView):
    """
    로그아웃 API (refresh 토큰 블랙리스트)
    POST /api/users/logout/
    Body: {"refresh": "<refresh_token>"}
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        """
        Body 에 refresh 토큰을 주거나, 쿠키의 refresh_token 을 사용해 로그아웃.
        항상 JWT 관련 쿠키를 삭제한다.
        """
        refresh = request.data.get("refresh") or request.COOKIES.get(
            "refresh_token"
        )
        if not refresh:
            response = Response(
                {"detail": "refresh 토큰이 필요합니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )
            return clear_jwt_cookies(response)

        try:
            token = RefreshToken(refresh)
            token.blacklist()
            response = Response(
                {"message": "로그아웃되었습니다."},
                status=status.HTTP_200_OK,
            )
            return clear_jwt_cookies(response)
        except TokenError:
            response = Response(
                {"detail": "유효하지 않거나 이미 블랙리스트된 토큰입니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )
            return clear_jwt_cookies(response)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def check_nickname(request):
    """
    닉네임 중복확인 API
    GET /api/users/check-nickname/?nickname=홍길동
    """
    nickname = request.query_params.get("nickname", "").strip()
    if not nickname:
        return Response(
            {"detail": "nickname 파라미터가 필요합니다."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    exists = User.objects.filter(nickname=nickname).exists()
    return Response({"available": not exists}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def check_student_id(request):
    """
    학번 중복확인 API
    GET /api/users/check-student-id/?student_id=20222882
    """
    student_id = request.query_params.get("student_id", "").strip()
    if not student_id:
        return Response(
            {"detail": "student_id 파라미터가 필요합니다."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    exists = User.objects.filter(student_id=student_id).exists()
    return Response({"available": not exists}, status=status.HTTP_200_OK)


class MyPostsView(generics.ListAPIView):
    """
    내가 쓴 글 목록
    GET /api/users/me/posts/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from apps.community.models import Post  # type: ignore[reportAttributeAccessIssue]

        return (
            Post.objects  # type: ignore[reportAttributeAccessIssue]
            .filter(author=self.request.user, is_deleted=False)
            .select_related("category")
            .order_by("-created_at")
        )

    def get_serializer_class(self):
        from apps.community.serializers import PostListSerializer
        return PostListSerializer


class MyCommentsView(generics.ListAPIView):
    """
    내가 쓴 댓글 목록
    GET /api/users/me/comments/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from apps.community.models import Comment  # type: ignore[reportAttributeAccessIssue]

        return (
            Comment.objects  # type: ignore[reportAttributeAccessIssue]
            .filter(author=self.request.user, is_deleted=False)
            .select_related("post")
            .order_by("-created_at")
        )

    def get_serializer_class(self):
        from apps.community.serializers import MyActivityCommentSerializer
        return MyActivityCommentSerializer


# ---------------------------------------------------------------------------
# 관리자 이메일/비밀번호 로그인 (is_staff만 허용)
# ---------------------------------------------------------------------------

class AdminLoginView(APIView):
    """
    POST /api/users/admin-login/
    Body: { "email": "...", "password": "..." }
    관리자(is_staff)만 로그인 가능. 성공 시 카카오 로그인과 동일한 토큰 응답.
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthThrottle]

    def post(self, request):
        serializer = AdminLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )
        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]
        user = authenticate(
            request,
            username=email,
            password=password,
        )
        if user is None:
            return Response(
                {"detail": "이메일 또는 비밀번호가 올바르지 않습니다."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        if not user.is_staff:
            return Response(
                {"detail": "관리자 계정만 로그인할 수 있습니다."},
                status=status.HTTP_403_FORBIDDEN,
            )
        refresh = RefreshToken.for_user(user)
        response = Response(
            {
                "message": "로그인 성공",
                "needs_profile": False,
                "user": UserSerializer(user).data,
                "tokens": {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                },
            },
            status=status.HTTP_200_OK,
        )
        set_jwt_cookies(
            response,
            access=str(refresh.access_token),
            refresh=str(refresh),
        )
        return response


# ---------------------------------------------------------------------------
# 카카오 소셜 로그인 + 온보딩
# ---------------------------------------------------------------------------

def _generate_unique_temp_nickname() -> str:
    """중복 없는 임시 닉네임 생성 (최대 5회 시도)"""
    for _ in range(5):
        candidate = f"temp_kakao_{get_random_string(12)}"
        if not User.objects.filter(nickname=candidate).exists():
            return candidate
    return f"temp_kakao_{get_random_string(20)}"


class KakaoLoginView(APIView):
    """
    POST /api/users/kakao/login/
    Body: { "access_token": "<카카오 access_token>" }

    응답:
    - 프로필 미완성:
      { "needs_profile": true, "signup_token": "..." }

    - 프로필 완성:
      {
        "message": "로그인 성공",
        "needs_profile": false,
        "user": {...},
        "tokens": { "access": "...", "refresh": "..." }
      }
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthThrottle]

    def _exchange_code_for_token(self, code: str, redirect_uri: str) -> str:
        """카카오 authorization code → access_token 교환"""
        redirect_uri = (redirect_uri or "").rstrip("/")
        payload = {
            "grant_type": "authorization_code",
            "client_id": settings.KAKAO_REST_API_KEY,
            "redirect_uri": redirect_uri,
            "code": code,
        }
        if getattr(settings, "KAKAO_CLIENT_SECRET", None):
            payload["client_secret"] = settings.KAKAO_CLIENT_SECRET
        resp = requests.post(
            "https://kauth.kakao.com/oauth/token",
            data=payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10,
        )
        if resp.status_code != 200:
            try:
                err = resp.json()
                msg = err.get("error_description") or resp.text or "토큰 교환 실패"
                raise ValueError(msg)
            except ValueError:
                raise
            except Exception:
                raise ValueError("카카오 토큰 교환 실패")
        return resp.json()["access_token"]

    def post(self, request, *args, **kwargs):
        input_serializer = KakaoLoginInputSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        data = cast(dict[str, Any], input_serializer.validated_data)
        if data.get("access_token"):
            kakao_access_token = data["access_token"]
        else:
            try:
                kakao_access_token = self._exchange_code_for_token(
                    data["code"], data["redirect_uri"]
                )
            except (ValueError, KeyError) as e:
                msg = str(e) if str(e) else "카카오 인증 코드 처리에 실패했습니다."
                return Response(
                    {"detail": msg},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            kakao_response = requests.get(
                "https://kapi.kakao.com/v2/user/me",
                headers={"Authorization": f"Bearer {kakao_access_token}"},
                timeout=5,
            )
        except requests.RequestException:
            return Response(
                {"detail": "카카오 서버와 통신에 실패했습니다."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if kakao_response.status_code != 200:
            return Response(
                {"detail": "유효하지 않은 카카오 액세스 토큰입니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        kakao_data = kakao_response.json()

        raw_kakao_id = kakao_data.get("id")
        if not raw_kakao_id:
            return Response(
                {"detail": "카카오 사용자 정보를 불러오지 못했습니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        kakao_id = str(raw_kakao_id)
        kakao_account = kakao_data.get("kakao_account", {})
        profile = kakao_account.get("profile", {})

        email = kakao_account.get("email") or None
        name = profile.get("nickname") or "카카오사용자"

        user, created = User.objects.get_or_create(
            kakao_id=kakao_id,
            defaults={
                "email": email,
                "name": name,
                "nickname": _generate_unique_temp_nickname(),
                "social_provider": User.SOCIAL_PROVIDER_KAKAO,
                "is_verified": True,
                "user_type": "",
                "is_profile_complete": False,
            },
        )

        if created:
            user.set_unusable_password()
            user.save()

        # 재로그인 시 카카오에서 받은 최신 정보 반영
        update_fields = []
        if user.social_provider != User.SOCIAL_PROVIDER_KAKAO:
            user.social_provider = User.SOCIAL_PROVIDER_KAKAO
            update_fields.append("social_provider")
        if user.email is None and email:
            user.email = email
            update_fields.append("email")
        if not user.name and name:
            user.name = name
            update_fields.append("name")
        if update_fields:
            user.save(update_fields=update_fields)

        create_event_log(
            event_type="login",
            page="/login",
            user_type=user.user_type or None,
            grade_at_event=user.grade,
            utm_source=request.query_params.get("utm_source"),
            user=user,
        )

        if not user.is_profile_complete:
            signup_token = generate_and_store_signup_token(user.id)
            return Response(
                {
                    "needs_profile": True,
                    "signup_token": signup_token,
                },
                status=status.HTTP_200_OK,
            )

        # 다부전공생은 승인 전까지 로그인 불가
        if user.is_multi_major and not user.multi_major_approved:
            return Response(
                {
                    "detail": "다부전공 인증이 승인 대기 중입니다. 승인 후 로그인할 수 있습니다.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "message": "로그인 성공",
                "needs_profile": False,
                "user": UserSerializer(user).data,
                "tokens": {
                    "access": str(refresh.access_token),  # type: ignore[reportAttributeAccessIssue]
                    "refresh": str(refresh),
                },
            },
            status=status.HTTP_200_OK,
        )


class CompleteProfileView(generics.GenericAPIView):
    """
    POST /api/users/social/complete-profile/
    Body:
    {
      "signup_token": "...",
      "user_type": "student" | "graduate",
      "nickname": "...",
      "department": "...",
      "email": "...",                 # 선택 입력
      "personal_info_consent": true,
      "student_id": "...",            # 재학생
      "grade": 1,                     # 재학생
      "admission_year": 2020          # 졸업생
    }

    응답:
    {
      "message": "회원가입이 완료되었습니다.",
      "user": {...},
      "tokens": { "access": "...", "refresh": "..." }
    }
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = CompleteProfileSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.save()

        delete_signup_token(serializer.validated_data["signup_token"])

        create_event_log(
            event_type="signup",
            page="/register",
            user_type=user.user_type or None,
            grade_at_event=user.grade,
            utm_source=request.query_params.get("utm_source"),
            user=user,
        )

        refresh = RefreshToken.for_user(user)

        response = Response(
            {
                "message": "회원가입이 완료되었습니다.",
                "user": UserSerializer(user).data,
                "tokens": {
                    "access": str(refresh.access_token),  # type: ignore[reportAttributeAccessIssue]
                    "refresh": str(refresh),
                },
            },
            status=status.HTTP_200_OK,
        )
        # 다부전공생은 승인 대기이므로 로그인 세션을 만들지 않는다.
        if not user.is_multi_major:
            set_jwt_cookies(
                response,
                access=str(refresh.access_token),
                refresh=str(refresh),
            )
        return response
