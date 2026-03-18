from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import PostViewSet, CommentViewSet, CategoryViewSet, DraftView, ImageUploadView

router = DefaultRouter()
router.register(r"posts", PostViewSet, basename="network-posts")
router.register(r"comments", CommentViewSet, basename="network-comments")
router.register(r"categories", CategoryViewSet, basename="network-categories")

urlpatterns = router.urls + [
    path("drafts/", DraftView.as_view(), name="network-draft"),
    path("images/upload/", ImageUploadView.as_view(), name="network-image-upload"),  # ← 추가
]