from django.urls import path

from .views import (
    DashboardKpiView,
    ErrorLogListView,
    ErrorLogStatsView,
    EventSettingListView,
    EventSettingToggleView,
    HeatmapView,
    KnowledgeDeliveryScoreView,
    OperationalLogListView,
    PageViewLogView,
    PageVisitorsView,
    PopularByGradeView,
    SearchRankingView,
    SessionAnalyticsView,
    SessionJourneyView,
    SessionStatsView,
    UserManagementView,
)

app_name = "logs"

urlpatterns = [
    path("analytics/dashboard-kpi/", DashboardKpiView.as_view(), name="dashboard-kpi"),
    path("analytics/operational-logs/", OperationalLogListView.as_view(), name="operational-logs"),
    path("analytics/heatmap/", HeatmapView.as_view(), name="heatmap"),
    path("analytics/popular-by-grade/", PopularByGradeView.as_view(), name="popular-by-grade"),
    path("analytics/search-ranking/", SearchRankingView.as_view(), name="search-ranking"),
    path(
        "analytics/knowledge-delivery-score/",
        KnowledgeDeliveryScoreView.as_view(),
        name="knowledge-delivery-score",
    ),
    path("analytics/page-visitors/", PageVisitorsView.as_view(), name="page-visitors"),
    path("analytics/session-stats/", SessionStatsView.as_view(), name="session-stats"),
    path("analytics/session-analytics/", SessionAnalyticsView.as_view(), name="session-analytics"),
    path("analytics/session-journey/", SessionJourneyView.as_view(), name="session-journey"),
    path("analytics/user-management/", UserManagementView.as_view(), name="user-management"),
    path("analytics/errors/", ErrorLogListView.as_view(), name="error-log-list"),
    path("analytics/errors/stats/", ErrorLogStatsView.as_view(), name="error-log-stats"),
    path("page-view/", PageViewLogView.as_view(), name="page-view"),
    path("event-settings/", EventSettingListView.as_view(), name="event-setting-list"),
    path(
        "event-settings/<str:event_type>/",
        EventSettingToggleView.as_view(),
        name="event-setting-toggle",
    ),
]
