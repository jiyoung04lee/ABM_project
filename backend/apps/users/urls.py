from django.urls import path

from . import views

app_name = "users"

urlpatterns = [
    # Health check (throttle 없음)
    path("health/", views.health_check, name="health_check"),
    # Authentication (AuthThrottle: 5/min)
    path("register/", views.RegisterView.as_view(), name="register"),
    path("login/", views.LoginView.as_view(), name="login"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("me/", views.MeView.as_view(), name="me"),
    path("me/posts/", views.MyPostsView.as_view(), name="my_posts"),
    path("me/comments/", views.MyCommentsView.as_view(), name="my_comments"),
    # 비밀번호 변경 (로그인 필수)
    path("change-password/", views.ChangePasswordView.as_view(), name="change_password"),
    # 중복확인 (throttle 없음)
    path("check-nickname/", views.check_nickname, name="check_nickname"),
    path("check-student-id/", views.check_student_id, name="check_student_id"),
    # Password reset (PasswordResetThrottle: 3/min)
    path("password-reset/request/", views.PasswordResetRequestView.as_view(), name="password_reset_request"),
    path("password-reset/confirm/", views.PasswordResetConfirmView.as_view(), name="password_reset_confirm"),
]
