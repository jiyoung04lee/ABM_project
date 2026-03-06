from django.urls import path

from . import views

app_name = "users"

urlpatterns = [

    # Health check
    path("health/", views.health_check, name="health_check"),

    # 내 정보
    path("me/", views.MeView.as_view(), name="me"),
    path("me/posts/", views.MyPostsView.as_view(), name="my_posts"),
    path("me/comments/", views.MyCommentsView.as_view(), name="my_comments"),

    # 로그아웃
    path("logout/", views.LogoutView.as_view(), name="logout"),

    # 중복 확인
    path("check-nickname/", views.check_nickname, name="check_nickname"),
    path("check-student-id/", views.check_student_id, name="check_student_id"),

    # 카카오 소셜 로그인
    path("kakao/login/", views.KakaoLoginView.as_view(), name="kakao_login"),

    # 소셜 온보딩
    path(
        "social/complete-profile/",
        views.CompleteProfileView.as_view(),
        name="complete_profile",
    ),
]
