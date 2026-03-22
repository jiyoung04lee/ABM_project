import requests
from typing import Any, cast
from django.conf import settings
from django.contrib.auth import authenticate
from django.http import JsonResponse
from django.utils.crypto import get_random_string
from django.db.models import Q
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import AllowAny

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
    generate_and_store_signup_token,
    delete_signup_token,
)

from .utils_score import give_login_point
from .utils_score import add_score
import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

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

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return UpdateProfileSerializer
        return UserSerializer

    def get_object(self):
        return self.request.user

    def retrieve(self, request, *args, **kwargs):
        from apps.community.models import Reaction
        from apps.networks.models import Reaction as NetworkReaction

        user = request.user

        community_likes = Reaction.objects.filter(user=user).count()
        network_likes = NetworkReaction.objects.filter(user=user).count()

        serializer = self.get_serializer(user)

        data = serializer.data
        data["liked_count"] = community_likes + network_likes

        return Response(data)


class LogoutView(generics.GenericAPIView):
    """
    로그아웃 API (refresh 토큰 블랙리스트)
    POST /api/users/logout/
    Body: {"refresh": "<refresh_token>"}
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        refresh = request.data.get("refresh")
        if not refresh:
            return Response(
                {"detail": "refresh 토큰이 필요합니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh)
            token.blacklist()
            return Response(
                {"message": "로그아웃되었습니다."},
                status=status.HTTP_200_OK,
            )
        except TokenError:
            return Response(
                {"detail": "유효하지 않거나 이미 블랙리스트된 토큰입니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )


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
    내가 쓴 글 목록 (커뮤니티 + 네트워크 통합)
    GET /api/users/me/posts/
    """
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, *args, **kwargs):
        from django.db.models import Exists, OuterRef

        from apps.community.models import Post as CommunityPost, Reaction
        from apps.community.serializers import PostListSerializer as CommunityPostListSerializer
        from apps.networks.models import Post as NetworkPost, Reaction as NetworkReaction
        from apps.networks.serializers import PostListSerializer as NetworkPostListSerializer

        user = request.user

        # 커뮤니티 글 (is_liked 어노테이션 추가)
        community_qs = (
            CommunityPost.objects
            .filter(author=user, is_deleted=False)
            .select_related("category")
            .prefetch_related("files")
            .annotate(
                is_liked=Exists(
                    Reaction.objects.filter(
                        post=OuterRef("pk"),
                        user=user,
                    )
                )
            )
            .order_by("-created_at")
        )
        community_serializer = CommunityPostListSerializer(
            community_qs, many=True, context={"request": request}
        )
        community_list = []
        for i, data in enumerate(community_serializer.data):
            item = dict(data)
            item["board_type"] = "community"
            item["view_count"] = getattr(
                community_qs[i], "view_count", 0
            )
            item["category_name"] = (
                community_qs[i].category.name
                if community_qs[i].category
                else "커뮤니티"
            )
            community_list.append(item)

        # 네트워크 글 (is_liked 어노테이션 추가)
        network_qs = (
            NetworkPost.objects
            .filter(author=user, is_deleted=False)
            .select_related("category")
            .prefetch_related("files")
            .annotate(
                is_liked=Exists(
                    NetworkReaction.objects.filter(
                        post=OuterRef("pk"),
                        user=user,
                    )
                )
            )
            .order_by("-created_at")
        )
        network_serializer = NetworkPostListSerializer(
            network_qs, many=True, context={"request": request}
        )
        network_list = []
        for data in network_serializer.data:
            item = dict(data)
            item["board_type"] = "network"
            network_list.append(item)

        # 합친 뒤 created_at 기준 최신순
        merged = community_list + network_list
        merged.sort(key=lambda x: x.get("created_at") or "", reverse=True)

        return Response(merged)


class MyCommentsView(generics.ListAPIView):
    """
    내가 쓴 댓글 목록 (커뮤니티 + 네트워크 통합)
    GET /api/users/me/comments/
    """
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, *args, **kwargs):

        from apps.community.models import Comment as CommunityComment
        from apps.networks.models import Comment as NetworkComment
        from apps.community.serializers import MyActivityCommentSerializer
        

        user = request.user

        # 커뮤니티 댓글
        community_qs = (
            CommunityComment.objects
            .filter(author=user, is_deleted=False)
            .select_related("post")
            .order_by("-created_at")
        )

        community_serializer = MyActivityCommentSerializer(community_qs, many=True)

        community_list = []
        for data in community_serializer.data:
            item = dict(data)
            item["board_type"] = "community"
            community_list.append(item)

        # 네트워크 댓글
        network_qs = (
            NetworkComment.objects
            .filter(author=user, is_deleted=False)
            .select_related("post")
            .order_by("-created_at")
        )

        network_serializer = MyActivityCommentSerializer(network_qs, many=True)

        network_list = []
        for data in network_serializer.data:
            item = dict(data)
            item["board_type"] = "network"
            network_list.append(item)

        merged = community_list + network_list

        merged.sort(key=lambda x: x.get("created_at") or "", reverse=True)

        return Response(merged)


# ---------------------------------------------------------------------------
# 관리자 이메일/비밀번호 로그인 (is_staff만 허용)
# ---------------------------------------------------------------------------

class AdminLoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthThrottle]

    def post(self, request):
        serializer = AdminLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]
        user = authenticate(request, username=email, password=password)

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

        # OTP 생성 및 이메일 발송
        import random, time
        from django.core.mail import send_mail
        from django.core.cache import cache

        otp_code = str(random.randint(100000, 999999))
        cache.set(f"admin_otp_{user.id}", otp_code, timeout=300)  # 5분

        try:
            message = Mail(
                from_email='aive.admin@gmail.com',
                to_emails=user.email,
                subject='[AIVE] 관리자 OTP 인증번호',
                plain_text_content=f'인증번호: {otp_code}\n5분 내로 입력해주세요.'
            )
            sg = SendGridAPIClient(os.environ.get('SENDGRID_API_KEY'))
            sg.send(message)
        except Exception as e:
            print(f"이메일 발송 실패: {e}")

        return Response(
            {"message": "OTP를 이메일로 발송했습니다.", "user_id": user.id},
            status=status.HTTP_200_OK,
        )


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

        # #region agent log
        try:
            import json as _json, time as _time
            from pathlib import Path as _Path

            _log_path = _Path("/Users/yunseongcheol/Developer/ABM_project/.cursor/debug-69648e.log")
            _payload = {
                "sessionId": "69648e",
                "runId": "pre-fix",
                "hypothesisId": "H1",
                "location": "apps.users.views.KakaoLoginView.post:get_or_create",
                "message": "About to get_or_create Kakao user",
                "data": {
                    "has_email": bool(email),
                    "has_name": bool(name),
                },
                "timestamp": int(_time.time() * 1000),
            }
            with _log_path.open("a", encoding="utf-8") as _f:
                _f.write(_json.dumps(_payload, ensure_ascii=False) + "\n")
        except Exception:
            pass
        # #endregion agent log

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
                "is_multi_major": False,
                "multi_major_approved": False,
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

        # 로그인 점수 
        give_login_point(user)

        if not user.is_profile_complete:
            signup_token = generate_and_store_signup_token(user.id)
            return Response(
                {
                    "needs_profile": True,
                    "signup_token": signup_token,
                },
                status=status.HTTP_200_OK,
            )

        if user.is_multi_major and not user.multi_major_approved:
            return Response(
                {
                    "needs_profile": False,
                    "multi_major_pending": True,
                    "message": "다부전공 승인 대기 중입니다.",
                },
                status=status.HTTP_200_OK,
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

        # 활동 점수 
        add_score(user, 30)

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

        return Response(
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
    

# 제외할 닉네임 목록
EXCLUDED_NICKNAMES = {"wldud", "김만덕", "닉네임"}
# 순위 불러 오기 
@api_view(["GET"])
@permission_classes([AllowAny])
def top_active_users(request):

    grade1 = (
        User.objects
        .filter(user_type="student", grade=1)
        .exclude(nickname__in=EXCLUDED_NICKNAMES) 
        .exclude(is_staff=True)    
        .order_by("-score")
        .first()
    )

    grade2 = (
        User.objects
        .filter(user_type="student", grade=2)
        .exclude(nickname__in=EXCLUDED_NICKNAMES) 
        .exclude(is_staff=True)   
        .order_by("-score")
        .first()
    )

    grade34 = (
        User.objects
        .filter(user_type="student")
        .filter(Q(grade=3) | Q(grade=4))
        .exclude(nickname__in=EXCLUDED_NICKNAMES) 
        .exclude(is_staff=True)   
        .order_by("-score")
        .first()
    )

    users = [u for u in [grade1, grade2, grade34] if u]

    result = []

    for u in users:
        result.append({
            "id": u.id,
            "nickname": u.nickname,
            "profile_image": u.profile_image.url if u.profile_image else None,
            "level": u.level,
        })

    return Response(result)


# 관리자 계정 OTP 검증 API 
class AdminOTPVerifyView(APIView):
    """
    POST /api/users/admin-otp-verify/
    Body: { "user_id": 2, "otp_code": "123456" }
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        import time
        from django.core.cache import cache

        user_id = request.data.get("user_id")
        otp_code = request.data.get("otp_code", "")

        if not user_id or not otp_code:
            return Response(
                {"detail": "user_id와 otp_code가 필요합니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        saved_code = cache.get(f"admin_otp_{user_id}")

        if not saved_code:
            return Response(
                {"detail": "인증번호가 만료됐어요. 다시 로그인해주세요."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if otp_code != saved_code:
            return Response(
                {"detail": "인증번호가 틀렸어요."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 인증 성공
        cache.delete(f"admin_otp_{user_id}")
        user = User.objects.get(id=user_id)
        refresh = RefreshToken.for_user(user)

        return Response(
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

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def multi_major_image_view(request, user_id):
    """
    GET /api/users/<user_id>/multi-major-image/
    본인 또는 관리자만 다부전공 이미지 접근 가능
    """
    if request.user.id != user_id and not request.user.is_staff:
        return Response(
            {"detail": "접근 권한이 없습니다."},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {"detail": "사용자를 찾을 수 없습니다."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if not user.multi_major_image:
        return Response(
            {"detail": "이미지가 없습니다."},
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response(
        {"url": user.multi_major_image.url},
        status=status.HTTP_200_OK,
    )
