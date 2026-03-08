from rest_framework.routers import DefaultRouter
from .views import SiteNoticeViewSet

router = DefaultRouter()
router.register("", SiteNoticeViewSet, basename="site-notice")
urlpatterns = router.urls
