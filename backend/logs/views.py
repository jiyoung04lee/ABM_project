from __future__ import annotations

import re
from collections import defaultdict
from collections.abc import Mapping
from datetime import date, timedelta

from django.db.models import Avg, Case, Count, IntegerField, Min, Max, Sum, When
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from django.db.models import Q
from django.db.models.functions import Extract
from django.utils import timezone

from .models import ApiErrorLog, DailyActiveUser, EventLog, EventSetting
from .utils import (
    EVENT_WEIGHTS,
    INTERACTION_EVENT_TYPES,
    analytics_today,
    clean_referrer_host,
    clean_short_text,
    get_analytics_timezone,
    refresh_event_setting_cache,
)

# ---------------------------------------------------------------------------
# 공통 상수
# ---------------------------------------------------------------------------
GRADES = [1, 2, 3, 4]
GRADE_LABEL = {1: "1학년", 2: "2학년", 3: "3학년", 4: "4학년"}

# 학년별 인기 글용: 1학년, 2학년, 3~4학년 묶음
GRADE_GROUPS = [(1, "1학년"), (2, "2학년"), (34, "3~4학년")]
GRADE_TO_GROUP = {1: 1, 2: 2, 3: 34, 4: 34}  # 3,4 -> 34

# 유저 관리 관심분야: 회원가입 시 AI / 데이터 / 경영 3개 중 선택 (저장값)
ALLOWED_INTERESTS = ("ai", "data", "business")  # AI, 데이터, 경영
INTEREST_LABEL = {"ai": "AI", "data": "데이터", "business": "경영"}

# 지식 전달 점수 가중치 (대시보드용)
# P: 게시글 작성 10점, C: 댓글 작성 5점, L: 받은 좋아요 2점
# 보너스: 소비자(좋아요/댓글 행위자)가 작성자보다 저학년이면 1.5배
KNOWLEDGE_SCORE_POST = 10
KNOWLEDGE_SCORE_COMMENT = 5
KNOWLEDGE_SCORE_RECEIVED_LIKE = 2
KNOWLEDGE_BONUS_MULTIPLIER = 1.5  # 저학년 → 선배 글 소비 시

# 지식 전달 차트: 1학년, 2학년, 3~4학년, 졸업생
KNOWLEDGE_GRADE_GROUPS = [
    (1, "1학년"),
    (2, "2학년"),
    (34, "3~4학년"),
    ("graduate", "졸업생"),
]

# 행동 분석 히트맵: 1학년, 2학년, 3~4학년, 졸업생 (작성자·조회자 동일)
HEATMAP_GROUPS = [(1, "1학년"), (2, "2학년"), (34, "3~4학년"), ("graduate", "졸업생")]
HEATMAP_GROUP_KEYS: list[int | str] = [1, 2, 34, "graduate"]


def _author_group(author_grade: int | None, author_user_type: str | None) -> int | str | None:
    """작성자 학년/유형 → 히트맵 그룹 (1, 2, 34, graduate)."""
    if author_user_type == "graduate" or author_grade is None:
        return "graduate" if author_user_type == "graduate" else None
    if author_grade in (3, 4):
        return 34
    return author_grade  # 1 or 2


def _viewer_group(grade_at_event: int | None, user_type: str | None) -> int | str | None:
    """조회자 학년/유형 → 히트맵 그룹."""
    if user_type == "graduate" or grade_at_event is None:
        return "graduate" if user_type == "graduate" else None
    if grade_at_event in (3, 4):
        return 34
    return grade_at_event


def _weight_annotation() -> Case:
    """각 이벤트 가중치를 DB 레벨에서 계산하는 Case 표현식."""
    whens = [
        When(event_type=evt, then=weight)
        for evt, weight in EVENT_WEIGHTS.items()
    ]
    return Case(*whens, default=0, output_field=IntegerField())


def _parse_analytics_period(request: Request) -> tuple:
    """
    start_date/end_date(YYYY-MM-DD, inclusive) 우선.
    없으면 days=1|7|30… (기본 1=오늘, 롤링 N일).
    반환: (start_date|None, end_date|None, days|None)
    """
    from django.utils.dateparse import parse_date

    start_s = (request.query_params.get("start_date") or "").strip()
    end_s = (request.query_params.get("end_date") or "").strip()
    if start_s and end_s:
        start = parse_date(start_s)
        end = parse_date(end_s)
        if start and end:
            if start > end:
                start, end = end, start
            return start, end, None

    days_param = request.query_params.get("days", "1")
    try:
        days = max(1, min(90, int(days_param)))
    except (ValueError, TypeError):
        days = 1
    return None, None, days


def _parse_analytics_period_optional(request: Request) -> tuple:
    """days/start_date 생략 시 전 기간(None). 대시보드 KPI 외 차트용."""
    from django.utils.dateparse import parse_date

    start_s = (request.query_params.get("start_date") or "").strip()
    end_s = (request.query_params.get("end_date") or "").strip()
    if start_s and end_s:
        start = parse_date(start_s)
        end = parse_date(end_s)
        if start and end:
            if start > end:
                start, end = end, start
            return start, end, None

    days_param = request.query_params.get("days")
    if days_param:
        try:
            days = max(1, min(90, int(days_param)))
            return None, None, days
        except (ValueError, TypeError):
            pass
    return None, None, None


def _period_response_meta(
    start_date: date | None, end_date: date | None, days: int | None
) -> dict[str, object]:
    if start_date and end_date:
        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        }
    return {"days": days}


def _resolve_analytics_period(
    request: Request, default_days: int | None = None
) -> tuple:
    """optional 파싱 + default_days(예: post-segment 30일)."""
    start_date, end_date, days = _parse_analytics_period_optional(request)
    if start_date is None and end_date is None and days is None and default_days is not None:
        days = default_days
    return start_date, end_date, days


def _filter_eventlog_by_period(qs, start_date, end_date, days):
    from datetime import timedelta

    if start_date and end_date:
        return qs.filter(
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
        )
    if days == 1:
        return qs.filter(created_at__date=timezone.localdate())
    if days is not None:
        since = timezone.now() - timedelta(days=days)
        return qs.filter(created_at__gte=since)
    return qs


def _filter_created_at_by_period(qs, start_date, end_date, days):
    from datetime import timedelta

    if start_date and end_date:
        return qs.filter(
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
        )
    if days == 1:
        return qs.filter(created_at__date=timezone.localdate())
    if days is not None:
        since = timezone.now() - timedelta(days=days)
        return qs.filter(created_at__gte=since)
    return qs


# ---------------------------------------------------------------------------
# 0. 대시보드 KPI (기간별 집계)
#    GET /api/logs/analytics/dashboard-kpi/?days=1|7|30
#    GET /api/logs/analytics/dashboard-kpi/?start_date=2026-05-01&end_date=2026-05-07
# ---------------------------------------------------------------------------
class DashboardKpiView(APIView):
    """
    대시보드 상단 KPI: 로그인, 신규 가입, 작성된 글, 댓글, 검색 수.
    쿼리 days=1(오늘), 7, 30 또는 start_date/end_date(달력 기간, inclusive).
    """
    permission_classes = [IsAdminUser]

    def get(self, request: Request) -> Response:
        start_date, end_date, days = _parse_analytics_period(request)
        qs = _filter_eventlog_by_period(
            EventLog.objects.all(), start_date, end_date, days
        )

        unique_visitors = (
            qs.filter(
                event_type="page_view",
                session_id__isnull=False,
            )
            .exclude(session_id="")
            .values("session_id")
            .distinct()
            .count()
        )

        post_views = qs.filter(event_type="post_view").count()
        engagements = (
            qs.filter(event_type="like").count()
            + qs.filter(event_type="comment").count()
        )
        engagement_rate = (
            round(engagements / post_views * 100, 1) if post_views > 0 else 0.0
        )

        return Response({
            "today_logins": qs.filter(event_type="login").count(),
            "today_signups": qs.filter(event_type="signup").count(),
            "today_posts": qs.filter(event_type="post_create").count(),
            "today_comments": qs.filter(event_type="comment").count(),
            "today_searches": qs.filter(event_type="search").count(),
            "post_views": post_views,
            "engagements": engagements,
            "engagement_rate": engagement_rate,
            "unique_visitors": unique_visitors,
            **_period_response_meta(start_date, end_date, days),
        })


# ---------------------------------------------------------------------------
# 0-2. 운영 로그 (EventLog 목록)
#    GET .../operational-logs/?page=1&page_size=20&event_type=login&q=...
# ---------------------------------------------------------------------------
class OperationalLogListView(APIView):
    """
    EventLog 목록. 페이지네이션, event_type 필터, q(검색).
    """
    permission_classes = [IsAdminUser]

    def get(self, request: Request) -> Response:
        qs = EventLog.objects.all().order_by("-created_at")
        event_type = request.query_params.get("event_type", "").strip()
        if event_type:
            qs = qs.filter(event_type=event_type)
        q = request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(section__icontains=q)
                | Q(page__icontains=q)
                | Q(search_keyword__icontains=q)
            )
        try:
            raw = request.query_params.get("page_size", 20)
            page_size = max(1, min(int(raw), 100))
        except (ValueError, TypeError):
            page_size = 20
        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except (ValueError, TypeError):
            page = 1
        total = qs.count()
        start = (page - 1) * page_size
        items = qs[start:start + page_size]
        results = []
        for e in items:
            details = e.event_type
            if e.event_type == "search" and e.search_keyword:
                details = f"Searched: {e.search_keyword}"
            elif e.event_type == "login":
                details = "Login"
            elif e.event_type == "signup":
                details = "Signup"
            elif e.event_type == "post_create":
                details = "New post"
            elif e.event_type == "comment":
                details = "Comment added"
            elif e.event_type == "page_view":
                details = f"Page view: {e.section or e.page or '-'}"
            row = {
                "id": e.id,
                "created_at": e.created_at.isoformat() if e.created_at else None,
                "event_type": e.event_type,
                "section": e.section,
                "page": e.page,
                "user_type": e.user_type,
                "grade_at_event": e.grade_at_event,
                "search_keyword": e.search_keyword,
                "details": details,
            }
            results.append(row)
        return Response({
            "results": results,
            "count": total,
            "page": page,
            "page_size": page_size,
        })


# ---------------------------------------------------------------------------
# 1. 히트맵 API
#    GET /api/logs/analytics/heatmap/
#    축: 1학년, 2학년, 3~4학년, 졸업생 (작성자 × 조회자)
# ---------------------------------------------------------------------------
class HeatmapView(APIView):
    """
    [작성자 학년 × 조회자 학년] 상호작용 히트맵.
    그룹: 1학년, 2학년, 3~4학년, 졸업생.
    """
    permission_classes = [IsAdminUser]

    def get(self, request: Request) -> Response:
        start_date, end_date, days = _resolve_analytics_period(request)
        rows = (
            _filter_eventlog_by_period(
                EventLog.objects.filter(event_type__in=INTERACTION_EVENT_TYPES),
                start_date,
                end_date,
                days,
            )
            .annotate(weight=_weight_annotation())
            .values(
                "author_grade_at_event",
                "author_user_type",
                "grade_at_event",
                "user_type",
                "weight",
            )
        )

        matrix: dict = {ag: {vg: 0 for vg in HEATMAP_GROUP_KEYS} for ag in HEATMAP_GROUP_KEYS}
        for row in rows:
            ag = _author_group(
                row.get("author_grade_at_event"),
                row.get("author_user_type"),
            )
            vg = _viewer_group(
                row.get("grade_at_event"),
                row.get("user_type"),
            )
            if ag is None or vg is None:
                continue
            matrix[ag][vg] += row.get("weight") or 0

        # 졸업생 가입자가 아직 없다면, 히트맵에서 졸업생 축은 숨긴다.
        from apps.users.models import User

        has_graduate_users = User.objects.filter(user_type="graduate").exists()
        author_groups = (
            HEATMAP_GROUPS
            if has_graduate_users
            else [(g, label) for (g, label) in HEATMAP_GROUPS if g != "graduate"]
        )
        viewer_keys = (
            HEATMAP_GROUP_KEYS
            if has_graduate_users
            else [g for g in HEATMAP_GROUP_KEYS if g != "graduate"]
        )

        result = []
        for ag, ag_label in author_groups:
            result.append(
                {
                    "author_grade": ag,
                    "author_grade_label": ag_label,
                    "cols": [
                        {
                            "viewer_grade": vg,
                            "viewer_grade_label": next(
                                lbl for g, lbl in HEATMAP_GROUPS if g == vg
                            ),
                            "score": matrix[ag][vg],
                        }
                        for vg in viewer_keys
                    ],
                }
            )
        return Response({"rows": result})


# ---------------------------------------------------------------------------
# 2. 학년별 인기 글 API
#    GET /api/logs/analytics/popular-by-grade/?top_n=5
#    학년: 1학년, 2학년, 3~4학년(묶음). 각 글에 section, title 포함.
# ---------------------------------------------------------------------------
class PopularByGradeView(APIView):
    """
    학년별로 가장 많이 열람/반응한 글 Top N.
    3·4학년은 묶어서 "3~4학년" 한 그룹으로 집계.
    """
    permission_classes = [IsAdminUser]

    def get(self, request: Request) -> Response:
        try:
            top_n = max(1, min(int(request.query_params.get("top_n", 5)), 20))
        except (ValueError, TypeError):
            top_n = 5

        rows = (
            _filter_eventlog_by_period(
                EventLog.objects.filter(
                    event_type__in=INTERACTION_EVENT_TYPES,
                    grade_at_event__in=GRADES,
                    post_id__isnull=False,
                    section__in=("community", "network"),
                ),
                *_resolve_analytics_period(request),
            )
            .values("grade_at_event", "section", "post_id")
            .annotate(score=Sum(_weight_annotation()))
        )

        # 그룹별 (section, post_id) -> 합산 score (3·4학년 묶음)
        by_group: dict[int, dict[tuple, int]] = {
            1: defaultdict(int),
            2: defaultdict(int),
            34: defaultdict(int),
        }
        for row in rows:
            g = row["grade_at_event"]
            group_id = GRADE_TO_GROUP[g]
            key = (row["section"], row["post_id"])
            by_group[group_id][key] += row["score"] or 0

        # 그룹별 Top N 추출
        top_by_group: dict[int, list[tuple]] = {}
        for group_id in (1, 2, 34):
            items = sorted(
                by_group[group_id].items(),
                key=lambda x: -x[1],
            )[:top_n]
            top_by_group[group_id] = [
                (section, post_id, score) for (section, post_id), score in items
            ]

        # 글 제목 조회 (section별 bulk)
        title_map: dict[tuple[str, int], str] = {}
        for group_id in (1, 2, 34):
            for section, post_id, _ in top_by_group[group_id]:
                key = (section, post_id)
                if key in title_map:
                    continue
                title_map[key] = ""  # placeholder

        community_ids = [pid for (sec, pid) in title_map if sec == "community"]
        network_ids = [pid for (sec, pid) in title_map if sec == "network"]
        if community_ids:
            from apps.community.models import Post as CommunityPost
            for p in CommunityPost.objects.filter(
                id__in=community_ids, is_deleted=False
            ).values("id", "title"):
                title_map[("community", p["id"])] = p["title"]
        if network_ids:
            from apps.networks.models import Post as NetworkPost
            for p in NetworkPost.objects.filter(
                id__in=network_ids, is_deleted=False
            ).values("id", "title"):
                title_map[("network", p["id"])] = p["title"]

        result = []
        for group_id, label in GRADE_GROUPS:
            posts = [
                {
                    "post_id": post_id,
                    "section": section,
                    "title": title_map.get((section, post_id), ""),
                    "score": score,
                }
                for section, post_id, score in top_by_group.get(group_id, [])
            ]
            result.append({
                "viewer_grade": group_id,
                "viewer_grade_label": label,
                "posts": posts,
            })

        return Response({"by_grade": result})


# ---------------------------------------------------------------------------
# 2-2. 관심분야별 인기 글 (post_view 조회 수)
#    GET /api/logs/analytics/popular-by-interest/?section=network&top_n=5&days=30
# ---------------------------------------------------------------------------
class PopularByInterestView(APIView):
    """
    온보딩 관심분야(ai/data/business)별 post_view 조회 Top N.
    section: community | network (기본 network).
    """
    permission_classes = [IsAdminUser]

    def get(self, request: Request) -> Response:
        section = request.query_params.get("section", "network").strip()
        if section not in ("community", "network"):
            section = "network"

        try:
            top_n = max(1, min(int(request.query_params.get("top_n", 5)), 20))
        except (ValueError, TypeError):
            top_n = 5

        start_date, end_date, days = _resolve_analytics_period(request)
        qs = _filter_eventlog_by_period(
            EventLog.objects.filter(
                event_type="post_view",
                section=section,
                post_id__isnull=False,
                interest_at_event__in=ALLOWED_INTERESTS,
            ),
            start_date,
            end_date,
            days,
        )

        rows = (
            qs.values("interest_at_event", "post_id")
            .annotate(view_count=Count("id"))
            .order_by("interest_at_event", "-view_count")
        )

        by_interest: dict[str, list[dict]] = {k: [] for k in ALLOWED_INTERESTS}
        for row in rows:
            interest = row["interest_at_event"]
            if interest not in by_interest:
                continue
            if len(by_interest[interest]) >= top_n:
                continue
            by_interest[interest].append(
                {"post_id": row["post_id"], "view_count": row["view_count"]}
            )

        post_ids = {
            item["post_id"]
            for items in by_interest.values()
            for item in items
        }
        title_map: dict[int, str] = {}
        if post_ids:
            if section == "community":
                from apps.community.models import Post as CommunityPost

                for p in CommunityPost.objects.filter(
                    id__in=post_ids, is_deleted=False
                ).values("id", "title"):
                    title_map[p["id"]] = p["title"]
            else:
                from apps.networks.models import Post as NetworkPost

                for p in NetworkPost.objects.filter(
                    id__in=post_ids, is_deleted=False
                ).values("id", "title"):
                    title_map[p["id"]] = p["title"]

        result = []
        for interest in ALLOWED_INTERESTS:
            posts = [
                {
                    "post_id": item["post_id"],
                    "title": title_map.get(item["post_id"], ""),
                    "view_count": item["view_count"],
                }
                for item in by_interest[interest]
            ]
            result.append({
                "interest": interest,
                "interest_label": INTEREST_LABEL[interest],
                "posts": posts,
            })

        return Response({"section": section, "by_interest": result})


# ---------------------------------------------------------------------------
# 2-3. 게시글별 학년×관심분야 조회 (제목 중심 + 세그먼트 Top 3)
#    GET /api/logs/analytics/post-segment-views/?section=network&top_posts=10&top_segments=3&days=30
# ---------------------------------------------------------------------------
GRADE_GROUP_LABEL = {1: "1학년", 2: "2학년", 34: "3~4학년"}


class PostSegmentViewsView(APIView):
    """
    post_view를 게시글(post_id) 단위로 묶고,
    각 글마다 (학년 그룹 × 관심분야) 조회 Top N 세그먼트와 1위 세그먼트를 반환.
    """
    permission_classes = [IsAdminUser]

    def get(self, request: Request) -> Response:
        section = request.query_params.get("section", "network").strip()
        if section not in ("community", "network"):
            section = "network"

        try:
            top_posts = max(1, min(int(request.query_params.get("top_posts", 10)), 30))
        except (ValueError, TypeError):
            top_posts = 10

        try:
            top_segments = max(1, min(int(request.query_params.get("top_segments", 3)), 10))
        except (ValueError, TypeError):
            top_segments = 3

        start_date, end_date, days = _resolve_analytics_period(request, default_days=30)
        qs = _filter_eventlog_by_period(
            EventLog.objects.filter(
                event_type="post_view",
                section=section,
                post_id__isnull=False,
                interest_at_event__in=ALLOWED_INTERESTS,
                grade_at_event__in=GRADES,
            ),
            start_date,
            end_date,
            days,
        )

        rows = (
            qs.annotate(
                grade_group=Case(
                    When(grade_at_event=1, then=1),
                    When(grade_at_event=2, then=2),
                    When(grade_at_event__in=[3, 4], then=34),
                    default=0,
                    output_field=IntegerField(),
                ),
            )
            .filter(grade_group__gt=0)
            .values("post_id", "grade_group", "interest_at_event")
            .annotate(view_count=Count("id"))
        )

        # post_id -> [(grade_group, interest, count), ...]
        by_post: dict[int, list[tuple[int, str, int]]] = defaultdict(list)
        for row in rows:
            by_post[row["post_id"]].append(
                (row["grade_group"], row["interest_at_event"], row["view_count"])
            )

        if not by_post:
            return Response({
                "section": section,
                **_period_response_meta(start_date, end_date, days),
                "posts": [],
            })

        # 총 조회수 기준 글 순위
        post_totals = [
            (post_id, sum(c for _, _, c in segs))
            for post_id, segs in by_post.items()
        ]
        post_totals.sort(key=lambda x: -x[1])
        top_post_ids = [pid for pid, _ in post_totals[:top_posts]]

        title_map: dict[int, str] = {}
        if section == "community":
            from apps.community.models import Post as CommunityPost

            for p in CommunityPost.objects.filter(
                id__in=top_post_ids, is_deleted=False
            ).values("id", "title"):
                title_map[p["id"]] = p["title"]
        else:
            from apps.networks.models import Post as NetworkPost

            for p in NetworkPost.objects.filter(
                id__in=top_post_ids, is_deleted=False
            ).values("id", "title"):
                title_map[p["id"]] = p["title"]

        def segment_payload(grade_group: int, interest: str, count: int, rank: int) -> dict:
            return {
                "rank": rank,
                "grade_group": grade_group,
                "grade_label": GRADE_GROUP_LABEL.get(grade_group, str(grade_group)),
                "interest": interest,
                "interest_label": INTEREST_LABEL.get(interest, interest),
                "view_count": count,
            }

        posts_result = []
        for post_id in top_post_ids:
            segs = sorted(by_post[post_id], key=lambda x: -x[2])[:top_segments]
            total = sum(c for _, _, c in by_post[post_id])
            top_segments_list = [
                segment_payload(g, i, c, r + 1)
                for r, (g, i, c) in enumerate(segs)
            ]
            primary = top_segments_list[0] if top_segments_list else None
            posts_result.append({
                "post_id": post_id,
                "title": title_map.get(post_id, ""),
                "total_views": total,
                "primary_segment": primary,
                "top_segments": top_segments_list,
            })

        return Response({
            "section": section,
            **_period_response_meta(start_date, end_date, days),
            "posts": posts_result,
        })


# ---------------------------------------------------------------------------
# 3. 인기 검색어 Top 10 API
#    GET /api/logs/analytics/search-ranking/?section=community&top_n=10&interest=ai
#    응답: total_search_count, ranking(키워드별 main_grade, main_interest)
# ---------------------------------------------------------------------------
class SearchRankingView(APIView):
    """
    검색어 인기 랭킹 (검색 횟수 기준).
    main_grade: 해당 키워드를 가장 많이 검색한 학년.
    main_interest: 해당 키워드를 가장 많이 검색한 관심분야 (ai/data/business).
    """
    permission_classes = [IsAdminUser]

    def get(self, request: Request) -> Response:
        try:
            top_n = max(1, min(int(request.query_params.get("top_n", 10)), 50))
        except (ValueError, TypeError):
            top_n = 10

        section = request.query_params.get("section")
        interest_param = request.query_params.get("interest")

        start_date, end_date, days = _resolve_analytics_period(request)
        qs = _filter_eventlog_by_period(
            EventLog.objects.filter(
                event_type="search",
                search_keyword__isnull=False,
            ).exclude(search_keyword=""),
            start_date,
            end_date,
            days,
        )

        if section:
            qs = qs.filter(section=section)
        if interest_param and interest_param in ALLOWED_INTERESTS:
            qs = qs.filter(interest_at_event=interest_param)

        total_search_count = qs.count()

        # 키워드별 총 검색 횟수
        keyword_counts = (
            qs
            .values("search_keyword")
            .annotate(count=Count("id"))
            .order_by("-count")[:top_n]
        )

        keywords = [row["search_keyword"] for row in keyword_counts]

        # 키워드별 주요 학년 (grade_at_event 최빈값)
        grade_rows = (
            qs
            .filter(search_keyword__in=keywords, grade_at_event__in=GRADES)
            .values("search_keyword", "grade_at_event")
            .annotate(cnt=Count("id"))
            .order_by("search_keyword", "-cnt")
        )
        main_grade_map: dict[str, int | None] = {}
        for row in grade_rows:
            kw = row["search_keyword"]
            if kw not in main_grade_map:
                main_grade_map[kw] = row["grade_at_event"]

        # 키워드별 주요 관심분야 (interest_at_event 최빈값)
        interest_rows = (
            qs
            .filter(search_keyword__in=keywords, interest_at_event__isnull=False)
            .exclude(interest_at_event="")
            .values("search_keyword", "interest_at_event")
            .annotate(cnt=Count("id"))
            .order_by("search_keyword", "-cnt")
        )
        main_interest_map: dict[str, str | None] = {}
        for row in interest_rows:
            kw = row["search_keyword"]
            if kw not in main_interest_map:
                main_interest_map[kw] = row["interest_at_event"]

        ranking = [
            {
                "rank": idx + 1,
                "keyword": row["search_keyword"],
                "count": row["count"],
                "main_grade": main_grade_map.get(row["search_keyword"]),
                "main_grade_label": GRADE_LABEL.get(
                    main_grade_map.get(row["search_keyword"], 0),  # type: ignore[arg-type]
                    "-",
                ),
                "main_interest": main_interest_map.get(row["search_keyword"]),
                "main_interest_label": INTEREST_LABEL.get(
                    main_interest_map.get(row["search_keyword"]) or "", "-"
                ),
            }
            for idx, row in enumerate(keyword_counts)
        ]
        return Response({
            "total_search_count": total_search_count,
            "ranking": ranking,
        })


# ---------------------------------------------------------------------------
# 3-2. 페이지 방문 로깅 (프론트에서 호출)
#    POST /api/logs/page-view/
#    Body: { "section": "community"|"network"|"department"|"home", "page": "/community" }
# ---------------------------------------------------------------------------
SECTION_LABELS = {
    "home": "홈",
    "community": "커뮤니티",
    "network": "네트워크",
    "department": "학과정보",
}
PAGE_VIEW_SECTIONS = ("home", "community", "network", "department")


class PageViewLogView(APIView):
    """
    프론트에서 페이지 진입 시 호출. page_view 이벤트 저장.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "event_track"

    def post(self, request: Request) -> Response:
        from rest_framework import status
        from .utils import create_event_log, get_viewer_grade_info

        data = getattr(request, "data", {}) or {}
        if not isinstance(data, Mapping):
            return Response(
                {"detail": "잘못된 요청 형식입니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        section = str(data.get("section") or "").strip().lower()
        page = str(data.get("page") or "").strip() or None
        session_id = str(data.get("session_id") or "").strip() or None
        if section not in PAGE_VIEW_SECTIONS:
            return Response(
                {"detail": "section은 home, community, network, department 중 하나여야 합니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # 이번 방문(세션)의 유입 정보. 세션 첫 페이지에서 프론트가 기록해 둔 값을 계속 전달한다.
        referrer_host = clean_referrer_host(data.get("referrer_host"))
        user = getattr(request, "user", None)
        viewer = get_viewer_grade_info(user) if user else {}
        create_event_log(
            event_type="page_view",
            section=section,
            page=page or f"/{section}",
            user_type=viewer.get("user_type"),
            grade_at_event=viewer.get("grade_at_event"),
            session_id=session_id,
            utm_source=data.get("utm_source"),
            properties={"referrer_host": referrer_host} if referrer_host else None,
            user=user,
        )
        return Response({"ok": True}, status=status.HTTP_201_CREATED)


_TRACK_TOKEN_RE = re.compile(r"^[a-z0-9_]{1,30}$")


def _clean_track_token(value: object) -> str:
    """로그인 요구 사유 등 짧은 식별자 (소문자·숫자·_)."""
    text = str(value or "").strip().lower()
    return text if _TRACK_TOKEN_RE.match(text) else ""


# ---------------------------------------------------------------------------
# 3-2b. 프론트에서만 알 수 있는 행동 이벤트 저장
#    POST /api/logs/track/
#    - login_wall_view: 로그인 화면 노출 (from, reason = 어디서 왜 로그인 요구를 받았나)
#    - write_start: 글쓰기 화면 진입 (community | network)
#    - search: 네트워크 검색 (네트워크 목록은 화면에서 필터링하므로 서버 요청이 없음)
# ---------------------------------------------------------------------------
TRACK_EVENT_TYPES = ("login_wall_view", "write_start", "search")
WRITE_SECTIONS = ("community", "network")
NETWORK_POST_TYPES = ("student", "graduate", "qa")


class TrackEventView(APIView):
    permission_classes = [AllowAny]
    # ScopedRateThrottle은 뷰의 throttle_scope가 있어야 동작한다 (페이지뷰와 공용, settings 참고)
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "event_track"

    def post(self, request: Request) -> Response:
        from rest_framework import status
        from .utils import (
            create_event_log,
            get_viewer_grade_info,
            get_viewer_interest_info,
        )

        data = getattr(request, "data", {}) or {}
        if not isinstance(data, Mapping):
            return Response(
                {"detail": "잘못된 요청 형식입니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        event_type = str(data.get("event_type") or "").strip()
        if event_type not in TRACK_EVENT_TYPES:
            return Response(
                {"detail": "지원하지 않는 event_type입니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = getattr(request, "user", None)
        if user is not None and not user.is_authenticated:
            user = None
        viewer = get_viewer_grade_info(user)
        common = {
            "user_type": viewer.get("user_type"),
            "grade_at_event": viewer.get("grade_at_event"),
            "user": user,
        }

        if event_type == "login_wall_view":
            origin = _clean_track_token(data.get("from"))
            reason = _clean_track_token(data.get("reason")) or "direct"
            create_event_log(
                event_type=event_type,
                section=origin if origin in PAGE_VIEW_SECTIONS else None,
                page="/login",
                properties={"from": origin, "reason": reason} if origin else {"reason": reason},
                **common,
            )
        elif event_type == "write_start":
            section = str(data.get("section") or "").strip().lower()
            if section not in WRITE_SECTIONS:
                return Response(
                    {"detail": "section은 community, network 중 하나여야 합니다."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            post_type = _clean_track_token(data.get("post_type"))
            create_event_log(
                event_type=event_type,
                section=section,
                page=f"/{section}/write",
                properties=(
                    {"post_type": post_type}
                    if section == "network" and post_type in NETWORK_POST_TYPES
                    else None
                ),
                **common,
            )
        else:  # search
            keyword = clean_short_text(data.get("keyword"), 100)
            if len(keyword) < 2:
                return Response(
                    {"detail": "검색어는 2자 이상이어야 합니다."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            create_event_log(
                event_type=event_type,
                section="network",
                page="/network",
                search_keyword=keyword,
                **get_viewer_interest_info(user),
                **common,
            )
        return Response({"ok": True}, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# 3-3. 페이지별 방문자 수 (행동 분석 차트)
#    GET /api/logs/analytics/page-visitors/?days=1|7|30 (기본 전 기간)
# ---------------------------------------------------------------------------
class PageVisitorsView(APIView):
    """
    section별 page_view 이벤트 건수. 순서: 커뮤니티, 학과정보, 네트워크, 홈.
    쿼리 days=1|7|30 이면 해당 기간만 집계. 생략 시 전 기간.
    """
    permission_classes = [IsAdminUser]

    def get(self, request: Request) -> Response:
        order = ["community", "department", "network", "home"]
        start_date, end_date, days = _parse_analytics_period_optional(request)
        qs = _filter_eventlog_by_period(
            EventLog.objects.filter(
                event_type="page_view",
                section__in=order,
            ),
            start_date,
            end_date,
            days,
        )

        rows = qs.values("section").annotate(count=Count("id"))
        by_section = {r["section"]: r["count"] for r in rows}
        result = [
            {
                "section": sec,
                "section_label": SECTION_LABELS.get(sec, sec),
                "count": by_section.get(sec, 0),
            }
            for sec in order
        ]
        return Response({"by_section": result})


# ---------------------------------------------------------------------------
# 3-4. 세션 통계 (평균 체류시간)
#    GET /api/logs/analytics/session-stats/?days=30
#    session_id가 있는 page_view만 집계. 프론트에서 방문 시 session_id 전달 필요.
# ---------------------------------------------------------------------------
def _format_duration(seconds: float) -> str:
    """초 → "M:SS" 또는 "H:MM:SS" 형식."""
    secs = int(round(seconds))
    if secs < 3600:
        return f"{secs // 60}:{(secs % 60):02d}"
    return f"{secs // 3600}:{(secs % 3600) // 60:02d}:{secs % 60:02d}"


class SessionStatsView(APIView):
    """
    세션별 첫/마지막 page_view 시간 차이로 평균 체류시간 반환.
    쿼리: days=30 (최근 N일, 생략 시 전 기간).
    """
    permission_classes = [IsAdminUser]

    def get(self, request: Request) -> Response:
        start_date, end_date, days = _resolve_analytics_period(request)
        qs = _filter_eventlog_by_period(
            EventLog.objects.filter(
                event_type="page_view",
                session_id__isnull=False,
            ).exclude(session_id=""),
            start_date,
            end_date,
            days,
        )

        rows = list(
            qs.values("session_id").annotate(
                first_at=Min("created_at"),
                last_at=Max("created_at"),
                page_views=Count("id"),
            )
        )
        total_sessions = len(rows)
        if total_sessions == 0:
            return Response({
                "average_session_seconds": 0,
                "average_session_display": "0:00",
                "total_sessions": 0,
            })
        durations = [
            (r["last_at"] - r["first_at"]).total_seconds()
            for r in rows
        ]
        average_seconds = sum(durations) / total_sessions
        return Response({
            "average_session_seconds": round(average_seconds, 1),
            "average_session_display": _format_duration(average_seconds),
            "total_sessions": total_sessions,
        })


# ---------------------------------------------------------------------------
# 3-5. 세션 분석 차트 (학년별 평균 세션 시간 + 세션 시간 분포)
#    GET /api/logs/analytics/session-analytics/?days=30
# ---------------------------------------------------------------------------
class SessionAnalyticsView(APIView):
    """
    학년별 평균 세션 시간(분) + 세션 시간 구간별 건수.
    - by_grade: 1학년, 2학년, 3학년, 4학년, 졸업생
    - distribution: 0-1분, 1-5분, 5-10분, 10-30분, 30분+
    """
    permission_classes = [IsAdminUser]

    GRADE_LABELS = [
        (1, "1학년"),
        (2, "2학년"),
        (3, "3학년"),
        (4, "4학년"),
        ("graduate", "졸업생"),
    ]
    BUCKETS = [
        (0, 60, "0-1분"),
        (60, 300, "1-5분"),
        (300, 600, "5-10분"),
        (600, 1800, "10-30분"),
        (1800, None, "30분+"),
    ]

    def get(self, request: Request) -> Response:
        start_date, end_date, days = _resolve_analytics_period(request)
        qs = _filter_eventlog_by_period(
            EventLog.objects.filter(
                event_type="page_view",
                session_id__isnull=False,
            ).exclude(session_id=""),
            start_date,
            end_date,
            days,
        ).values("session_id", "created_at", "grade_at_event", "user_type").order_by(
            "session_id", "created_at"
        )

        rows = list(qs)
        # 세션별 그룹: { session_id: [ (created_at, grade_at_event, user_type), ... ] }
        from collections import defaultdict
        by_sid: dict[str, list[tuple]] = defaultdict(list)
        for r in rows:
            g = r.get("grade_at_event")
            ut = (r.get("user_type") or "").strip()
            by_sid[r["session_id"]].append((r["created_at"], g, ut))

        session_durations: list[tuple[float, int | str]] = []
        for events in by_sid.values():
            if not events:
                continue
            first_at = events[0][0]
            last_at = events[-1][0]
            dur = (last_at - first_at).total_seconds()
            _, g, ut = events[0]
            # 졸업생: user_type 이 graduate 인 경우만 집계
            if ut == "graduate":
                gk: int | str = "graduate"
            # 재학생: 학년 정보(1~4)가 있을 때만 집계
            elif g in (1, 2, 3, 4):
                gk = g  # type: ignore[assignment]
            # 그 외(비회원 / 학년 정보 없음)는 세션 분석에서 제외
            else:
                continue
            session_durations.append((dur, gk))

        # 학년별 평균 (분)
        by_grade: dict[int | str, list[float]] = {1: [], 2: [], 3: [], 4: [], "graduate": []}
        for dur, gk in session_durations:
            if gk in by_grade:
                by_grade[gk].append(dur / 60.0)

        by_grade_result = []
        for grade_key, label in self.GRADE_LABELS:
            vals = by_grade.get(grade_key, [])
            avg_min = round(sum(vals) / len(vals), 1) if vals else 0
            by_grade_result.append({
                "grade_key": grade_key,
                "grade_label": label,
                "average_minutes": avg_min,
                "session_count": len(vals),
            })

        # 세션 시간 분포
        dist_counts = [0] * len(self.BUCKETS)
        for dur, _ in session_durations:
            for i, (lo, hi, _) in enumerate(self.BUCKETS):
                if hi is None:
                    if dur >= lo:
                        dist_counts[i] += 1
                        break
                elif lo <= dur < hi:
                    dist_counts[i] += 1
                    break

        distribution = [
            {"bucket": label, "count": dist_counts[i]}
            for i, (_, _, label) in enumerate(self.BUCKETS)
        ]

        return Response({
            "by_grade": by_grade_result,
            "distribution": distribution,
        })


# ---------------------------------------------------------------------------
# 4. 지식 전달 점수 (학년별)
#    GET /api/logs/analytics/knowledge-delivery-score/?days=1|7|30 (기본 전 기간)
#    P: 게시글 10점, C: 댓글 5점, L: 받은 좋아요 2점 → 학년(1/2/3-4/졸업생)별 합산
# ---------------------------------------------------------------------------
class KnowledgeDeliveryScoreView(APIView):
    """
    학년별 지식 전달 점수.
    - 게시글 작성(P): 10점, 댓글 작성(C): 5점, 받은 좋아요(L): 2점
    - 보너스: 소비자가 작성자보다 저학년이면 C·L에 1.5배
    - 쿼리 days=1|7|30 이면 해당 기간 내 생성된 글/댓글·이벤트만 집계.
    """
    permission_classes = [IsAdminUser]

    def get(self, request: Request) -> Response:
        from apps.users.models import User
        from apps.community.models import Post as CPost, Comment as CComment
        from apps.networks.models import Post as NPost, Comment as NComment

        start_date, end_date, days = _parse_analytics_period_optional(request)

        # 졸업생 가입자가 실제로 존재하는지 확인
        has_graduate_users = User.objects.filter(user_type="graduate").exists()

        # user_id -> grade_group (1, 2, 34, "graduate")
        user_groups: dict[int, int | str] = {}
        for u in User.objects.values("id", "grade", "user_type"):
            # 명시적으로 graduate 인 경우만 졸업생 그룹으로 분류
            if u["user_type"] == "graduate":
                user_groups[u["id"]] = "graduate"
            elif u["user_type"] == "student" and u["grade"] in (3, 4):
                user_groups[u["id"]] = 34
            elif u["user_type"] == "student" and u["grade"] in (1, 2):
                user_groups[u["id"]] = u["grade"]

        groups: list[int | str] = [1, 2, 34]
        if has_graduate_users:
            groups.append("graduate")
        agg = {
            g: {
                "post_count": 0,
                "comment_count": 0,
                "received_likes": 0,
                "comment_score": 0.0,
                "like_score": 0.0,
            }
            for g in groups
        }

        c_post_qs = CPost.objects.filter(is_deleted=False)
        n_post_qs = NPost.objects.filter(is_deleted=False)
        c_comment_qs = CComment.objects.filter(is_deleted=False)
        n_comment_qs = NComment.objects.filter(is_deleted=False)
        c_post_qs = _filter_created_at_by_period(c_post_qs, start_date, end_date, days)
        n_post_qs = _filter_created_at_by_period(n_post_qs, start_date, end_date, days)
        c_comment_qs = _filter_created_at_by_period(c_comment_qs, start_date, end_date, days)
        n_comment_qs = _filter_created_at_by_period(n_comment_qs, start_date, end_date, days)

        # P, L 기본치: Post/Comment 테이블 기준
        for row in c_post_qs.values("author_id", "like_count"):
            g = user_groups.get(row["author_id"])
            if g is None:
                continue
            agg[g]["post_count"] += 1
            agg[g]["received_likes"] += row["like_count"] or 0

        for row in n_post_qs.values("author_id", "like_count"):
            g = user_groups.get(row["author_id"])
            if g is None:
                continue
            agg[g]["post_count"] += 1
            agg[g]["received_likes"] += row["like_count"] or 0

        for row in c_comment_qs.values("author_id"):
            g = user_groups.get(row["author_id"])
            if g is None:
                continue
            agg[g]["comment_count"] += 1

        for row in n_comment_qs.values("author_id"):
            g = user_groups.get(row["author_id"])
            if g is None:
                continue
            agg[g]["comment_count"] += 1

        # 보너스: EventLog에서 소비자 학년 < 작성자 학년이면 1.5배 (재학생 작성자만)
        like_log_qs = EventLog.objects.filter(
            event_type="like",
            section__in=("community", "network"),
            post_id__isnull=False,
            author_grade_at_event__in=GRADES,
            grade_at_event__in=GRADES,
        )
        like_log_qs = _filter_eventlog_by_period(
            like_log_qs, start_date, end_date, days
        )
        for row in like_log_qs.values("author_grade_at_event", "grade_at_event"):
            author_g = row["author_grade_at_event"]
            consumer_g = row["grade_at_event"]
            group = 34 if author_g in (3, 4) else author_g
            mult = (
                KNOWLEDGE_BONUS_MULTIPLIER
                if consumer_g < author_g
                else 1.0
            )
            agg[group]["like_score"] += (
                KNOWLEDGE_SCORE_RECEIVED_LIKE * mult
            )

        comment_log_qs = EventLog.objects.filter(
            event_type="comment",
            section__in=("community", "network"),
            post_id__isnull=False,
            author_grade_at_event__in=GRADES,
            grade_at_event__in=GRADES,
        )
        comment_log_qs = _filter_eventlog_by_period(
            comment_log_qs, start_date, end_date, days
        )
        for row in comment_log_qs.values("author_grade_at_event", "grade_at_event"):
            author_g = row["author_grade_at_event"]
            consumer_g = row["grade_at_event"]
            group = 34 if author_g in (3, 4) else author_g
            mult = (
                KNOWLEDGE_BONUS_MULTIPLIER
                if consumer_g < author_g
                else 1.0
            )
            agg[group]["comment_score"] += KNOWLEDGE_SCORE_COMMENT * mult

        # 졸업생: EventLog에 author_grade 없음 → 단순 합산
        for g in (1, 2, 34):
            if agg[g]["comment_score"] == 0:
                agg[g]["comment_score"] = (
                    agg[g]["comment_count"] * KNOWLEDGE_SCORE_COMMENT
                )
            if agg[g]["like_score"] == 0:
                agg[g]["like_score"] = (
                    agg[g]["received_likes"] * KNOWLEDGE_SCORE_RECEIVED_LIKE
                )
        if has_graduate_users:
            agg["graduate"]["comment_score"] = (
                agg["graduate"]["comment_count"] * KNOWLEDGE_SCORE_COMMENT
            )
            agg["graduate"]["like_score"] = (
                agg["graduate"]["received_likes"] * KNOWLEDGE_SCORE_RECEIVED_LIKE
            )

        result = []
        grade_groups = (
            KNOWLEDGE_GRADE_GROUPS
            if has_graduate_users
            else [
                (k, label)
                for (k, label) in KNOWLEDGE_GRADE_GROUPS
                if k != "graduate"
            ]
        )
        for grade_key, grade_label in grade_groups:
            a = agg.get(grade_key, {})
            post_count = a.get("post_count", 0)
            comment_count = a.get("comment_count", 0)
            received_likes = a.get("received_likes", 0)
            post_score = post_count * KNOWLEDGE_SCORE_POST
            comment_score = a.get("comment_score", 0)
            like_score = a.get("like_score", 0)
            total_score = post_score + comment_score + like_score

            result.append({
                "grade_key": grade_key,
                "grade_label": grade_label,
                "post_count": post_count,
                "comment_count": comment_count,
                "received_likes": received_likes,
                "post_score": post_score,
                "comment_score": round(comment_score, 1),
                "like_score": round(like_score, 1),
                "total_score": round(total_score, 1),
            })

        return Response({"by_grade": result})


# ---------------------------------------------------------------------------
# 5. 유저 관리 API (기여도 순위/XP 없음)
#    GET /api/logs/analytics/user-management/
#    닉네임, 관심분야, 게시물 수, 댓글 수만 반환.
# ---------------------------------------------------------------------------
class UserManagementView(APIView):
    """
    관리자용 유저 목록.
    관심분야: 회원가입 시 스크롤에서 AI / 데이터 / 경영 3개 중 선택 (저장값: ai, data, business).
    쿼리 파라미터:
      - grade=1|2|3|4  (학년 필터, 복수 가능)
      - interest=ai|data|business  (관심분야 필터, 위 3개만 유효, 복수 가능)
    """
    permission_classes = [IsAdminUser]

    def get(self, request: Request) -> Response:
        from django.db.models import Q
        from apps.users.models import User

        qs = User.objects.annotate(
            post_count=Count(
                "posts",
                filter=Q(posts__is_deleted=False),
                distinct=True,
            ),
            comment_count=Count(
                "comment",
                filter=Q(comment__is_deleted=False),
                distinct=True,
            ),
        )

        # 온보딩 미완료자는 관리자 대시보드 계산에서 제외
        qs = qs.filter(is_profile_complete=True)

        # user_type 필터 (예: 졸업생 탭)
        user_type = request.query_params.get("user_type")
        if user_type in ("student", "graduate"):
            qs = qs.filter(user_type=user_type)

        # 학년 필터 (?grade=1&grade=2 등 복수 허용)
        grade_params = request.query_params.getlist("grade")
        if grade_params:
            grades = []
            for g in grade_params:
                try:
                    grades.append(int(g))
                except ValueError:
                    pass
            if grades:
                qs = qs.filter(grade__in=grades)

        # 관심분야 필터: AI(ai) / 데이터(data) / 경영(business) 3개만 허용
        interest_params = request.query_params.getlist("interest")
        if interest_params:
            allowed = [x for x in interest_params if x in ALLOWED_INTERESTS]
            if allowed:
                interest_q = Q()
                for interest in allowed:
                    interest_q |= Q(interests__contains=interest)
                qs = qs.filter(interest_q)

        users = qs.order_by("nickname").values(
            "id",
            "user_type",
            "nickname",
            "grade",
            "interests",
            "post_count",
            "comment_count",
            "score",
        )

        result = [
            {
                "id": u["id"],
                "user_type": u.get("user_type"),
                "nickname": u["nickname"] or "",
                "grade": u["grade"],
                "interests": u["interests"] or [],
                "post_count": u["post_count"] or 0,
                "comment_count": u["comment_count"] or 0,
                "score": u.get("score") or 0,
            }
            for u in users
        ]
        return Response({"users": result, "count": len(result)})


# ---------------------------------------------------------------------------
# 에러 모니터링
#    GET /api/logs/analytics/errors/          목록 (검색·필터·페이지네이션)
#    GET /api/logs/analytics/errors/stats/    오늘 에러 수 + 시간대별 추이
# ---------------------------------------------------------------------------
class ErrorLogListView(APIView):
    """
    API 에러 로그 목록. 엔드포인트·메시지 검색, status_code 필터.
    """
    permission_classes = [IsAdminUser]

    def get(self, request: Request) -> Response:
        qs = ApiErrorLog.objects.all().order_by("-created_at")
        q = request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(path__icontains=q) | Q(message__icontains=q)
            )
        status_param = request.query_params.get("status_code")
        if status_param:
            try:
                qs = qs.filter(status_code=int(status_param))
            except ValueError:
                pass
        try:
            page_size = max(1, min(int(request.query_params.get("page_size", 20)), 100))
        except (ValueError, TypeError):
            page_size = 20
        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except (ValueError, TypeError):
            page = 1
        total = qs.count()
        start = (page - 1) * page_size
        items = qs[start:start + page_size]
        results = [
            {
                "id": e.id,
                "created_at": e.created_at.isoformat() if e.created_at else None,
                "path": e.path,
                "method": e.method,
                "status_code": e.status_code,
                "message": e.message,
            }
            for e in items
        ]
        return Response({
            "results": results,
            "count": total,
            "page": page,
            "page_size": page_size,
        })


# ---------------------------------------------------------------------------
# 세션 여정맵 - 섹션 전환 흐름
#    GET /api/logs/analytics/session-journey/?top_n=10
# ---------------------------------------------------------------------------
class SessionJourneyView(APIView):
    """
    session_id가 있는 page_view 로그를 기반으로
    섹션 간 전환 흐름 빈도 집계 (from_section → to_section).
    top_n: 상위 몇 개 전환을 반환할지 (기본 15).
    """
    permission_classes = [IsAdminUser]

    SECTION_LABEL = {
        "home": "홈",
        "community": "커뮤니티",
        "network": "네트워크",
        "department": "학과정보",
    }

    def get(self, request: Request) -> Response:
        try:
            top_n = max(1, min(int(request.query_params.get("top_n", 15)), 50))
        except (ValueError, TypeError):
            top_n = 15

        start_date, end_date, days = _resolve_analytics_period(request)
        qs = _filter_eventlog_by_period(
            EventLog.objects.filter(
                event_type="page_view",
                session_id__isnull=False,
                section__isnull=False,
            ),
            start_date,
            end_date,
            days,
        ).values("session_id", "section", "created_at").order_by(
            "session_id", "created_at"
        )

        # 세션별로 섹션 순서 묶기 → 전환 쌍(from→to) 카운트
        transitions: dict[tuple[str, str], int] = {}
        prev_session: str | None = None
        prev_section: str | None = None
        for row in qs:
            sid = row["session_id"]
            sec = row["section"]
            if sid == prev_session and prev_section and sec != prev_section:
                key = (prev_section, sec)
                transitions[key] = transitions.get(key, 0) + 1
            elif sid != prev_session:
                prev_section = sec
            else:
                prev_section = sec
            prev_session = sid

        sorted_transitions = sorted(
            transitions.items(), key=lambda x: x[1], reverse=True
        )[:top_n]

        results = [
            {
                "from_section": fs,
                "from_label": self.SECTION_LABEL.get(fs, fs),
                "to_section": ts,
                "to_label": self.SECTION_LABEL.get(ts, ts),
                "count": cnt,
            }
            for (fs, ts), cnt in sorted_transitions
        ]

        # 섹션별 방문 빈도 (여정맵 보조 정보)
        section_visits = (
            _filter_eventlog_by_period(
                EventLog.objects.filter(
                    event_type="page_view",
                    section__isnull=False,
                ),
                start_date,
                end_date,
                days,
            )
            .values("section")
            .annotate(visits=Count("id"))
            .order_by("-visits")
        )
        visits_list = [
            {
                "section": r["section"],
                "label": self.SECTION_LABEL.get(r["section"], r["section"]),
                "visits": r["visits"],
            }
            for r in section_visits
        ]

        return Response({
            "transitions": results,
            "section_visits": visits_list,
        })


class ErrorLogStatsView(APIView):
    """
    오늘 에러 수 + 시간대별 에러 발생 추이 (0~23시)
    + 평균 응답시간(ms) + 총 요청수(EventLog page_view).
    """
    permission_classes = [IsAdminUser]

    def get(self, request: Request) -> Response:
        today = timezone.localdate()
        qs_today = ApiErrorLog.objects.filter(created_at__date=today)
        today_count = qs_today.count()
        by_hour = (
            qs_today
            .annotate(hour=Extract("created_at", "hour"))
            .values("hour")
            .annotate(count=Count("id"))
            .order_by("hour")
        )
        trend = [0] * 24
        for row in by_hour:
            h = row.get("hour")
            if h is not None and 0 <= h < 24:
                trend[h] = row["count"]
        # 평균 응답시간 (오늘 에러 기준, response_time_ms 있는 것만)
        avg_rt = (
            qs_today
            .filter(response_time_ms__isnull=False)
            .aggregate(avg=Avg("response_time_ms"))["avg"]
        )
        avg_response_time_ms = round(avg_rt) if avg_rt is not None else None
        # 총 요청수: EventLog page_view 오늘 건수 (근사치)
        total_requests = EventLog.objects.filter(
            event_type="page_view",
            created_at__date=today,
        ).count()
        return Response({
            "today_count": today_count,
            "trend": [{"hour": h, "count": trend[h]} for h in range(24)],
            "avg_response_time_ms": avg_response_time_ms,
            "total_requests": total_requests,
        })


# ---------------------------------------------------------------------------
# 이벤트 추적 ON/OFF (대시보드 스위치)
#   GET  /api/logs/event-settings/             목록 (event_type, category, is_active, count)
#   PATCH /api/logs/event-settings/<event_type>/  is_active 변경 후 캐시 갱신
# ---------------------------------------------------------------------------
class EventSettingListView(APIView):
    """이벤트 설정 목록. 각 event_type별 is_active와 EventLog 건수."""
    permission_classes = [IsAdminUser]

    def get(self, request: Request) -> Response:
        from django.db.models import Count
        settings = list(
            EventSetting.objects.order_by("category", "event_type")
        )
        counts = dict(
            EventLog.objects.values("event_type").annotate(
                count=Count("id")
            ).values_list("event_type", "count")
        )
        results = [
            {
                "event_type": s.event_type,
                "category": s.category,
                "is_active": s.is_active,
                "log_count": counts.get(s.event_type, 0),
            }
            for s in settings
        ]
        return Response({"results": results})


class AdminInsightView(APIView):
    """
    현재 집계 데이터를 Claude API에 보내 마케팅/UX 인사이트를 반환.
    GET /api/logs/analytics/insights/?days=7
    """
    permission_classes = [IsAdminUser]

    def get(self, request: Request) -> Response:
        import os, json
        from datetime import timedelta

        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            return Response({"detail": "ANTHROPIC_API_KEY가 설정되지 않았습니다."}, status=503)

        start_date, end_date, days = _parse_analytics_period(request)
        qs = _filter_eventlog_by_period(EventLog.objects.all(), start_date, end_date, days)

        # ── KPI 집계 ──
        post_views = qs.filter(event_type="post_view").count()
        engagements = qs.filter(event_type="like").count() + qs.filter(event_type="comment").count()
        kpi = {
            "logins": qs.filter(event_type="login").count(),
            "signups": qs.filter(event_type="signup").count(),
            "posts_created": qs.filter(event_type="post_create").count(),
            "comments": qs.filter(event_type="comment").count(),
            "searches": qs.filter(event_type="search").count(),
            "post_views": post_views,
            "engagements": engagements,
            "engagement_rate_pct": round(engagements / post_views * 100, 1) if post_views else 0.0,
            "unique_sessions": (
                qs.filter(event_type="page_view", session_id__isnull=False)
                .exclude(session_id="").values("session_id").distinct().count()
            ),
        }

        # ── 섹션별 방문수 ──
        order = ["community", "department", "network", "home"]
        sec_rows = (
            qs.filter(event_type="page_view", section__in=order)
            .values("section").annotate(count=Count("id"))
        )
        by_section = {r["section"]: r["count"] for r in sec_rows}
        page_visitors = {SECTION_LABELS.get(s, s): by_section.get(s, 0) for s in order}

        # ── 학년별 이벤트 비중 ──
        grade_rows = (
            qs.filter(event_type__in=["login", "post_view", "post_create"])
            .values("grade_at_event", "event_type").annotate(cnt=Count("id"))
        )
        grade_summary: dict = {}
        for r in grade_rows:
            g = f"{r['grade_at_event']}학년" if r["grade_at_event"] else "미상/졸업생"
            grade_summary.setdefault(g, {})[r["event_type"]] = r["cnt"]

        # ── 검색어 Top 5 ──
        search_top = list(
            qs.filter(event_type="search", search_keyword__isnull=False)
            .exclude(search_keyword="")
            .values("search_keyword").annotate(cnt=Count("id"))
            .order_by("-cnt")[:5]
            .values_list("search_keyword", "cnt")
        )

        data = {
            "period": _period_response_meta(start_date, end_date, days),
            "kpi": kpi,
            "page_visitors": page_visitors,
            "grade_activity": grade_summary,
            "top_searches": [{"keyword": k, "count": c} for k, c in search_top],
        }

        # ── Claude API 호출 ──
        try:
            from anthropic import Anthropic
            client = Anthropic(api_key=api_key)
            system = (
                "너는 AIVE 학과 아카이브 플랫폼의 데이터 분석가야. "
                "주어진 운영 데이터를 분석해서 관리자가 바로 행동할 수 있는 인사이트를 한국어로 작성해줘. "
                "관점은 두 축: (1) 마케터 관점 — 유입·전환·성장, (2) UX 관점 — 이탈·콘텐츠 참여·섹션 쏠림.\n\n"
                "반드시 아래 JSON 형식만 출력해 (머리말·설명 금지):\n"
                '{"summary":"전체 상황 한 줄 요약",'
                '"key_findings":["발견1","발견2","발견3"],'
                '"action_items":[{"priority":"high","action":"...","reason":"..."}],'
                '"metrics_highlight":{"지표명":"값+짧은 해석"}}'
            )
            resp = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1500,
                system=system,
                messages=[{
                    "role": "user",
                    "content": "AIVE 운영 데이터:\n\n" + json.dumps(data, ensure_ascii=False, indent=2),
                }],
            )
            text = "".join(
                b.text for b in resp.content if getattr(b, "type", None) == "text"
            ).strip()
            # JSON 펜스 제거
            if text.startswith("```"):
                text = text.split("```", 2)[1]
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip().strip("`").strip()
            insight = json.loads(text)
        except Exception as e:
            return Response({"detail": f"AI 인사이트 생성 실패: {e}"}, status=502)

        return Response({"period": data["period"], "insight": insight})


class EventSettingToggleView(APIView):
    """event_type별 is_active 토글. PATCH body: {"is_active": true|false}. 호출 후 캐시 갱신."""
    permission_classes = [IsAdminUser]

    def patch(self, request: Request, event_type: str) -> Response:
        try:
            setting = EventSetting.objects.get(event_type=event_type)
        except EventSetting.DoesNotExist:
            return Response(
                {"detail": f"EventSetting not found: {event_type}"},
                status=404,
            )
        is_active = request.data.get("is_active")
        if is_active is None:
            return Response(
                {"detail": "is_active is required"},
                status=400,
            )
        setting.is_active = bool(is_active)
        setting.save(update_fields=["is_active"])
        refresh_event_setting_cache()
        return Response({
            "event_type": setting.event_type,
            "category": setting.category,
            "is_active": setting.is_active,
        })


# ---------------------------------------------------------------------------
# 9. 활성 사용자 지표 (DAU / WAU / MAU / 재방문율 / 주간 유지율)
#    GET /api/logs/analytics/active-users/
#
# DailyActiveUser 기반. 모든 날짜는 ANALYTICS_TIME_ZONE(Asia/Seoul) 기준.
# 주(week)는 월요일 시작 ~ 일요일 종료.
#
# 측정 시작일(tracking_since) 이전 데이터가 없으므로, 배포 초기에는
# 재방문율/주간 유지율이 구조적으로 왜곡된다. 0%로 오해되지 않도록
# rate를 null로 두고 status로 집계 가능 여부를 함께 반환한다.
#   ready   : 정상 집계
#   partial : 계산은 되나 측정 시작일이 구간 안에 있어 과소집계 가능
#   pending : 분모가 성립하지 않아 계산 불가 (집계 중)
# ---------------------------------------------------------------------------
STATUS_READY = "ready"
STATUS_PARTIAL = "partial"
STATUS_PENDING = "pending"


def _distinct_user_ids(start: date, end: date) -> set[int]:
    """[start, end] 구간(양끝 포함)에 활성이었던 user_id 집합."""
    return set(
        DailyActiveUser.objects.filter(
            date__gte=start, date__lte=end
        ).values_list("user_id", flat=True)
    )


def _window_block(
    label_start: date,
    end: date,
    tracking_since: date | None,
) -> dict[str, object]:
    """
    WAU/MAU용 롤링 윈도우 블록.

    측정 시작일이 윈도우 시작보다 늦으면 실제로 커버된 구간은 그만큼 짧다.
    프론트에서 '현재까지 누적된 범위'임을 표시할 수 있도록
    effective_start / days_covered / days_expected를 함께 반환한다.
    """
    days_expected = (end - label_start).days + 1
    if tracking_since is None:
        return {
            "value": 0,
            "status": STATUS_PENDING,
            "window": {
                "start": label_start.isoformat(),
                "end": end.isoformat(),
            },
            "effective_start": None,
            "days_covered": 0,
            "days_expected": days_expected,
        }

    effective_start = max(label_start, tracking_since)
    value = len(_distinct_user_ids(effective_start, end))
    days_covered = (end - effective_start).days + 1
    status = STATUS_READY if tracking_since <= label_start else STATUS_PARTIAL
    return {
        "value": value,
        "status": status,
        "window": {
            "start": label_start.isoformat(),
            "end": end.isoformat(),
        },
        "effective_start": effective_start.isoformat(),
        "days_covered": days_covered,
        "days_expected": days_expected,
    }


class ActiveUserStatsView(APIView):
    """
    DAU / WAU / MAU / DAU·MAU / 재방문율 / 주간 유지율.

    기간 선택기의 영향을 받지 않는 '오늘 기준' 고정 윈도우 지표다.
    """

    permission_classes = [IsAdminUser]

    def get(self, request: Request) -> Response:
        today = analytics_today()
        tracking_since = DailyActiveUser.objects.aggregate(
            v=Min("date")
        )["v"]

        # ── DAU (unique는 UniqueConstraint로 이미 보장됨) ──
        dau = DailyActiveUser.objects.filter(date=today).count()

        # ── WAU / MAU (오늘 포함 롤링 7일 / 30일) ──
        wau = _window_block(today - timedelta(days=6), today, tracking_since)
        mau = _window_block(today - timedelta(days=29), today, tracking_since)

        mau_value = mau["value"]
        dau_mau_ratio = (
            round(dau / mau_value * 100, 1) if mau_value else None
        )

        return Response({
            "as_of": today.isoformat(),
            "tracking_since": (
                tracking_since.isoformat() if tracking_since else None
            ),
            "tracking_days": (
                (today - tracking_since).days + 1 if tracking_since else 0
            ),
            "timezone": str(get_analytics_timezone()),

            "dau": dau,
            "wau": wau,
            "mau": mau,
            "dau_mau_ratio": dau_mau_ratio,

            "returning_user_rate": self._returning_user_rate(
                today, tracking_since
            ),
            "weekly_retention": self._weekly_retention(today, tracking_since),
        })

    # -- 재방문율 -----------------------------------------------------------
    def _returning_user_rate(
        self, today: date, tracking_since: date | None
    ) -> dict[str, object]:
        """
        오늘 활성 사용자 중, 오늘 이전에도 활성이었던 적 있는 사용자 비율.

        측정 시작일이 오늘이면 '이전 기록'이 존재할 수 없어 0%가 되는데,
        이는 재방문이 없다는 뜻이 아니라 데이터가 없다는 뜻이므로 pending 처리.
        """
        today_ids = _distinct_user_ids(today, today)
        active_users = len(today_ids)

        if tracking_since is None or tracking_since >= today:
            return {
                "status": STATUS_PENDING,
                "rate": None,
                "returning_users": None,
                "new_users": None,
                "active_users": active_users,
            }

        if not today_ids:
            return {
                "status": STATUS_READY,
                "rate": 0.0,
                "returning_users": 0,
                "new_users": 0,
                "active_users": 0,
            }

        returning = (
            DailyActiveUser.objects.filter(
                user_id__in=today_ids, date__lt=today
            )
            .values("user_id")
            .distinct()
            .count()
        )
        return {
            "status": STATUS_READY,
            "rate": round(returning / active_users * 100, 1),
            "returning_users": returning,
            "new_users": active_users - returning,
            "active_users": active_users,
        }

    # -- 주간 유지율 ---------------------------------------------------------
    def _weekly_retention(
        self, today: date, tracking_since: date | None
    ) -> dict[str, object]:
        """
        지난주 활성 사용자 중 이번주에도 활성인 사용자의 비율.
        주는 월요일 시작 ~ 일요일 종료.

        이번주는 아직 진행 중일 수 있어 분자가 과소 집계되므로
        this_week_in_progress로 알린다.
        """
        this_monday = today - timedelta(days=today.weekday())
        last_monday = this_monday - timedelta(days=7)
        last_sunday = this_monday - timedelta(days=1)
        this_sunday = this_monday + timedelta(days=6)

        block: dict[str, object] = {
            "last_week": {
                "start": last_monday.isoformat(),
                "end": last_sunday.isoformat(),
            },
            "this_week": {
                "start": this_monday.isoformat(),
                "end": this_sunday.isoformat(),
            },
            "this_week_in_progress": today < this_sunday,
        }

        # 지난주 데이터가 아예 없으면 분모가 성립하지 않음
        if tracking_since is None or tracking_since > last_sunday:
            block.update({
                "status": STATUS_PENDING,
                "rate": None,
                "retained_users": None,
                "last_week_active_users": None,
            })
            return block

        last_week_ids = _distinct_user_ids(last_monday, last_sunday)
        if not last_week_ids:
            block.update({
                "status": STATUS_PENDING,
                "rate": None,
                "retained_users": None,
                "last_week_active_users": 0,
            })
            return block

        this_week_ids = _distinct_user_ids(this_monday, today)
        retained = len(last_week_ids & this_week_ids)

        # 측정 시작일이 지난주 안에 있으면 분모가 과소 집계됨
        status = (
            STATUS_READY if tracking_since <= last_monday else STATUS_PARTIAL
        )
        block.update({
            "status": status,
            "rate": round(retained / len(last_week_ids) * 100, 1),
            "retained_users": retained,
            "last_week_active_users": len(last_week_ids),
        })
        return block


# ---------------------------------------------------------------------------
# 10. 비활성 사용자 복귀 분석
#     GET /api/logs/analytics/reactivation/
#         ?policy_date=2026-10-01&inactive_days=14&observation_days=14
#
# 질문: "정책 시행 전 일정 기간 방문하지 않던 기존 회원이, 시행 후 다시 왔는가?"
#
# 정책 시행일 T에 대해
#   비활성 판정 구간 = [T - inactive_days, T - 1]
#   복귀 관찰 구간   = [T, T + observation_days - 1]
#
# DailyActiveUser(user, date) + User만으로 계산한다(신규 테이블 없음).
# 쿼리는 구간별 user_id 집합 3번으로 고정 — N+1이 발생하지 않는다.
#
# status는 ActiveUserStatsView와 같은 의미로 쓴다.
#   ready   : 비활성 판정 구간 전체가 측정 범위 안
#   partial : 구간 일부만 측정됨 → 비활성자가 과대 집계될 수 있음
#   pending : 판정 불가(측정 이전 구간 / 미래 시행일) 또는 분모 0 → rate=null
# ---------------------------------------------------------------------------
REACTIVATION_MAX_DAYS = 180


def _eligible_user_ids(policy_date: date) -> set[int]:
    """
    정책 시행일 T 이전에 가입한 '복귀 가능한' 기존 회원.

    제외 대상과 이유:
      - is_staff          : 운영자. create_event_log/DAU 집계와 동일 정책
      - is_active=False   : 비활성 계정. 복귀 자체가 불가능
      - 다부전공 미승인   : PendingAwareJWTAuthentication이 비로그인 취급하므로
                            DailyActiveUser 행이 생길 수 없음. 분모에 넣으면
                            영구 미복귀로 잡혀 복귀율이 구조적으로 낮아진다.
    """
    from apps.users.models import User

    qs = (
        User.objects.filter(created_at__date__lt=policy_date, is_active=True)
        .exclude(is_staff=True)
        .exclude(is_multi_major=True, multi_major_approved=False)
    )
    return set(qs.values_list("id", flat=True))


class ReactivationAnalysisView(APIView):
    """
    비활성 회원 복귀 분석. 대시보드 전역 기간 선택기와 무관하게
    policy_date / inactive_days / observation_days만으로 동작한다.
    """

    permission_classes = [IsAdminUser]

    def get(self, request: Request) -> Response:
        from rest_framework import status as http_status
        from django.utils.dateparse import parse_date

        raw_policy = (request.query_params.get("policy_date") or "").strip()
        if not raw_policy:
            return Response(
                {"detail": "policy_date는 필수입니다 (YYYY-MM-DD)."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        policy_date = parse_date(raw_policy)
        if policy_date is None:
            return Response(
                {"detail": "policy_date 형식이 올바르지 않습니다 (YYYY-MM-DD)."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        try:
            inactive_days = int(request.query_params.get("inactive_days", 14))
            observation_days = int(
                request.query_params.get("observation_days", 14)
            )
        except (TypeError, ValueError):
            return Response(
                {"detail": "inactive_days/observation_days는 정수여야 합니다."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        if not (1 <= inactive_days <= REACTIVATION_MAX_DAYS) or not (
            1 <= observation_days <= REACTIVATION_MAX_DAYS
        ):
            return Response(
                {
                    "detail": (
                        "inactive_days/observation_days는 "
                        f"1~{REACTIVATION_MAX_DAYS} 범위여야 합니다."
                    )
                },
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        today = analytics_today()
        tracking_since = DailyActiveUser.objects.aggregate(
            v=Min("date")
        )["v"]

        iw_start = policy_date - timedelta(days=inactive_days)
        iw_end = policy_date - timedelta(days=1)
        ow_start = policy_date
        ow_end = policy_date + timedelta(days=observation_days - 1)

        eligible_ids = _eligible_user_ids(policy_date)

        payload: dict[str, object] = {
            "as_of": today.isoformat(),
            "policy_date": policy_date.isoformat(),
            "tracking_since": (
                tracking_since.isoformat() if tracking_since else None
            ),
            "inactive_window": {
                "start": iw_start.isoformat(),
                "end": iw_end.isoformat(),
                "days": inactive_days,
                "effective_start": None,
                "days_covered": 0,
            },
            "observation_window": {
                "start": ow_start.isoformat(),
                "end": ow_end.isoformat(),
                "days": observation_days,
                "days_elapsed": max(
                    0, min(observation_days, (today - ow_start).days + 1)
                ),
            },
            "observation_in_progress": today < ow_end,
            "eligible_users": len(eligible_ids),
            "inactive_users": None,
            "returned_users": None,
            "reactivation_rate": None,
            "status": STATUS_PENDING,
        }

        # ── 판정 불가: 시행일이 미래이거나, 비활성 구간이 측정 이전 ──
        if policy_date > today:
            payload["unavailable_reason"] = "policy_date_in_future"
            return Response(payload)
        if tracking_since is None or tracking_since > iw_end:
            payload["unavailable_reason"] = "inactive_window_not_tracked"
            return Response(payload)

        effective_start = max(iw_start, tracking_since)
        payload["inactive_window"]["effective_start"] = (
            effective_start.isoformat()
        )
        payload["inactive_window"]["days_covered"] = (
            (iw_end - effective_start).days + 1
        )

        # ── 비활성자 = 기존 회원 중 판정 구간에 방문 기록이 없는 사람 ──
        active_in_window = set(
            DailyActiveUser.objects.filter(
                user_id__in=eligible_ids,
                date__gte=iw_start,
                date__lte=iw_end,
            ).values_list("user_id", flat=True)
        )
        inactive_ids = eligible_ids - active_in_window
        payload["inactive_users"] = len(inactive_ids)

        coverage_status = (
            STATUS_READY if tracking_since <= iw_start else STATUS_PARTIAL
        )

        # ── 분모 0: 0%가 아니라 계산 불가로 둔다 (주간 유지율과 동일 규칙) ──
        if not inactive_ids:
            payload["status"] = STATUS_PENDING
            payload["unavailable_reason"] = "no_inactive_users"
            return Response(payload)

        returned = (
            DailyActiveUser.objects.filter(
                user_id__in=inactive_ids,
                date__gte=ow_start,
                date__lte=ow_end,
            )
            .values("user_id")
            .distinct()
            .count()
        )
        payload["returned_users"] = returned
        payload["reactivation_rate"] = round(
            returned / len(inactive_ids) * 100, 1
        )
        payload["status"] = coverage_status
        return Response(payload)
