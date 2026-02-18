from django.urls import path

from . import views

app_name = "users"

urlpatterns = [
    # Health check (throttle 없음)
    path("health/", views.health_check, name="health_check"),
    # Authentication (AuthThrottle: 5/min)
    path("register/", views.RegisterView.as_view(), name="register"),
    path("verify-email/", views.VerifyEmailView.as_view(), name="verify_email"),
    path("login/", views.LoginView.as_view(), name="login"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("me/", views.MeView.as_view(), name="me"),
    # Password reset (PasswordResetThrottle: 3/min)
    path("password-reset/request/", views.PasswordResetRequestView.as_view(), name="password_reset_request"),
    path("password-reset/confirm/", views.PasswordResetConfirmView.as_view(), name="password_reset_confirm"),
]
