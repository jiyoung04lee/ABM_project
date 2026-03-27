from django.urls import path
from .views import top_active_users

from . import views

app_name = "users"

urlpatterns = [

    # Health check
    path("health/", views.health_check, name="health_check"),

    # 내 정보
    path("me/", views.MeView.as_view(), name="me"),
    path("admin-info/", views.admin_info, name="admin_info"),
    path("me/posts/", views.MyPostsView.as_view(), name="my_posts"),
    path("me/comments/", views.MyCommentsView.as_view(), name="my_comments"),

    # 우수자 순위 
    path("top-active/", top_active_users),

    # 로그아웃
    path("logout/", views.LogoutView.as_view(), name="logout"),

    # 중복 확인
    path("check-nickname/", views.check_nickname, name="check_nickname"),
    path("check-student-id/", views.check_student_id, name="check_student_id"),

    # 관리자 이메일/비밀번호 로그인
    path("admin-login/", views.AdminLoginView.as_view(), name="admin_login"),
    path("admin-otp-verify/", views.AdminOTPVerifyView.as_view(), name="admin_otp_verify"),

    # 카카오 소셜 로그인
    path("kakao/login/", views.KakaoLoginView.as_view(), name="kakao_login"),

    # 소셜 온보딩
    path(
        "social/onboarding-session/",
        views.OnboardingSessionView.as_view(),
        name="onboarding_session",
    ),
    path(
        "social/complete-profile/",
        views.CompleteProfileView.as_view(),
        name="complete_profile",
    ),

    path('<int:user_id>/multi-major-image/', views.multi_major_image_view, name='multi_major_image'),
]
