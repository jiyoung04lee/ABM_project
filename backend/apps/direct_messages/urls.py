from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ConversationViewSet,
    MessageViewSet,
    ConversationStartViewSet
)

router = DefaultRouter()
router.register("conversations", ConversationViewSet, basename="conversation")
router.register("messages", MessageViewSet, basename="message")

urlpatterns = router.urls + [
    path("start/", ConversationStartViewSet.as_view({"post": "create"})),
]