from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.http import JsonResponse
from logs.utils import create_event_log

from .models import User
from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    UserSerializer,
    EmailVerificationSerializer,
    ChangePasswordSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
)
from .utils import (
    generate_password_reset_token,
    store_password_reset_token,
    get_email_from_password_reset_token,
    delete_password_reset_token,
    send_password_reset_email,
)
from .throttles import AuthThrottle, PasswordResetThrottle


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def health_check(request):
    """
    간단한 헬스체크용 API.
    프론트에서 백엔드 서버 살아있는지 확인할 때 사용.
    (throttle 없음)
    """
    return JsonResponse({"status": "ok"})


class RegisterView(generics.CreateAPIView):
    """
    회원가입 API
    POST /api/users/register/
    Throttle: AuthThrottle (IP 기준 분당 5회)
    """
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthThrottle]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # 로그 저장 (회원가입)
        create_event_log(
            event_type="signup",
            page="/api/users/register/",
            user_type=user.user_type,
            grade_at_event=user.grade,
            utm_source=request.query_params.get("utm_source"),
        )

        return Response(
            {
                "message": "회원가입이 완료되었습니다.",
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(generics.GenericAPIView):
    """
    이메일 인증 API
    POST /api/users/verify-email/
    Body: {"token": "인증토큰"}
    Throttle: AuthThrottle (IP 기준 분당 5회)
    """
    serializer_class = EmailVerificationSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthThrottle]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]
        token = serializer.validated_data["token"]

        # 이메일 인증 완료 처리
        user.is_verified = True
        user.save()

        # 토큰 삭제
        delete_verification_token(token)

        return Response(
            {
                "message": "이메일 인증이 완료되었습니다.",
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


class LoginView(generics.GenericAPIView):
    """
    로그인 API (JWT 발급)
    POST /api/users/login/
    Body: {"email": "user@example.com", "password": "password"}
    Throttle: AuthThrottle (IP 기준 분당 5회)
    """
    serializer_class = LoginSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthThrottle]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]

        # JWT 토큰 생성
        refresh = RefreshToken.for_user(user)
        access_token = refresh.access_token

        # 🔥 로그 저장 (로그인)
        create_event_log(
            event_type="login",
            page="/api/users/login/",
            user_type=user.user_type,
            grade_at_event=user.grade,
            utm_source=request.query_params.get("utm_source"),
        )

        return Response(
            {
                "message": "로그인 성공",
                "user": UserSerializer(user).data,
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(access_token),
                },
            },
            status=status.HTTP_200_OK,
        )


class MeView(generics.RetrieveAPIView):
    """
    현재 로그인한 사용자 정보 조회 API
    GET /api/users/me/
    (throttle 없음)
    """
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


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
        except TokenError as e:
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


class ChangePasswordView(generics.GenericAPIView):
    """
    비밀번호 변경 API (로그인 상태 필수)
    POST /api/users/change-password/
    Body: {"current_password": "...", "new_password": "...", "new_password_confirm": "..."}
    """
    serializer_class = ChangePasswordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save()
        return Response(
            {"message": "비밀번호가 변경되었습니다."},
            status=status.HTTP_200_OK,
        )


class PasswordResetRequestView(generics.GenericAPIView):
    """
    비밀번호 재설정 요청
    POST /api/users/password-reset/request/
    Body: {"email": "user@example.com"}
    Throttle: PasswordResetThrottle (IP 기준 분당 3회)
    토큰은 응답에 노출하지 않고 메일 발송 훅만 호출.
    """
    serializer_class = PasswordResetRequestSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        user = serializer.validated_data.get("user")
        if not user:
            return Response(
                {"message": "해당 이메일로 가입된 사용자가 있으면 이메일을 발송했습니다."},
                status=status.HTTP_200_OK,
            )
        token = generate_password_reset_token()
        store_password_reset_token(user.email, token)
        send_password_reset_email(user.email, token)
        return Response(
            {"message": "해당 이메일로 가입된 사용자가 있으면 이메일을 발송했습니다."},
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(generics.GenericAPIView):
    """
    비밀번호 재설정 확인 (토큰 + 새 비밀번호)
    POST /api/users/password-reset/confirm/
    Body: {"token": "...", "new_password": "...", "new_password_confirm": "..."}
    Throttle: PasswordResetThrottle (IP 기준 분당 3회)
    """
    serializer_class = PasswordResetConfirmSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        new_password = serializer.validated_data["new_password"]
        user.set_password(new_password)
        user.save()
        token = serializer.validated_data["token"]
        delete_password_reset_token(token)
        return Response(
            {"message": "비밀번호가 변경되었습니다."},
            status=status.HTTP_200_OK,
        )
