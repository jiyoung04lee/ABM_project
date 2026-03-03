from rest_framework.routers import DefaultRouter
from .views import PostViewSet, CommentViewSet, CategoryViewSet

router = DefaultRouter()
router.register(r"posts", PostViewSet, basename="network-posts")
router.register(r"comments", CommentViewSet, basename="network-comments")
router.register(r"categories", CategoryViewSet, basename="network-categories")

urlpatterns = router.urls