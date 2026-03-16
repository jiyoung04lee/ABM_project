from __future__ import annotations

from collections import defaultdict

from django.db.models import Avg, Case, Count, IntegerField, Min, Max, Sum, When
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from django.db.models import Q
from django.db.models.functions import Extract
from django.utils import timezone

from .models import ApiErrorLog, EventLog, EventSetting
from .utils import (
    EVENT_WEIGHTS,
    INTERACTION_EVENT_TYPES,
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


# ---------------------------------------------------------------------------
# 0. 대시보드 KPI (기간별 집계)
#    GET /api/logs/analytics/dashboard-kpi/?days=1|7|30 (기본 1=오늘)
# ---------------------------------------------------------------------------
class DashboardKpiView(APIView):
    """
    대시보드 상단 KPI: 로그인, 신규 가입, 작성된 글, 댓글, 검색 수.
    쿼리 days=1(오늘), 7(지난 7일), 30(지난 30일). 기본 1.
    """
    permission_classes = [IsAdminUser]

    def get(self, request: Request) -> Response:
        from datetime import timedelta

        days_param = request.query_params.get("days", "1")
        try:
            days = max(1, min(90, int(days_param)))
        except (ValueError, TypeError):
            days = 1

        if days == 1:
            today = timezone.localdate()
            qs = EventLog.objects.filter(created_at__date=today)
        else:
            since = timezone.now() - timedelta(days=days)
            qs = EventLog.objects.filter(created_at__gte=since)

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

        return Response({
            "today_logins": qs.filter(event_type="login").count(),
            "today_signups": qs.filter(event_type="signup").count(),
            "today_posts": qs.filter(event_type="post_create").count(),
            "today_comments": qs.filter(event_type="comment").count(),
            "today_searches": qs.filter(event_type="search").count(),
            "unique_visitors": unique_visitors,
            "days": days,
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
        rows = (
            EventLog.objects
            .filter(event_type__in=INTERACTION_EVENT_TYPES)
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
            EventLog.objects
            .filter(
                event_type__in=INTERACTION_EVENT_TYPES,
                grade_at_event__in=GRADES,
                post_id__isnull=False,
                section__in=("community", "network"),
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

        qs = EventLog.objects.filter(
            event_type="search",
            search_keyword__isnull=False,
        ).exclude(search_keyword="")

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

    def post(self, request: Request) -> Response:
        from rest_framework import status
        from .utils import create_event_log, get_viewer_grade_info

        data = getattr(request, "data", {}) or {}
        section = str(data.get("section") or "").strip().lower()
        page = str(data.get("page") or "").strip() or None
        session_id = (data.get("session_id") or "").strip() or None
        if section not in PAGE_VIEW_SECTIONS:
            return Response(
                {"detail": "section은 home, community, network, department 중 하나여야 합니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = getattr(request, "user", None)
        viewer = get_viewer_grade_info(user) if user else {}
        create_event_log(
            event_type="page_view",
            section=section,
            page=page or f"/{section}",
            user_type=viewer.get("user_type"),
            grade_at_event=viewer.get("grade_at_event"),
            session_id=session_id,
            user=user,
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
        from datetime import timedelta

        order = ["community", "department", "network", "home"]
        qs = EventLog.objects.filter(
            event_type="page_view",
            section__in=order,
        )
        days_param = request.query_params.get("days")
        if days_param:
            try:
                days = max(1, min(90, int(days_param)))
                since = timezone.now() - timedelta(days=days)
                qs = qs.filter(created_at__gte=since)
            except (ValueError, TypeError):
                pass

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
        from datetime import timedelta

        qs = (
            EventLog.objects
            .filter(event_type="page_view", session_id__isnull=False)
            .exclude(session_id="")
        )
        days_param = request.query_params.get("days")
        if days_param:
            try:
                since = timezone.now() - timedelta(days=int(days_param))
                qs = qs.filter(created_at__gte=since)
            except (ValueError, TypeError):
                pass

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
        from datetime import timedelta

        qs = (
            EventLog.objects
            .filter(event_type="page_view", session_id__isnull=False)
            .exclude(session_id="")
            .values("session_id", "created_at", "grade_at_event", "user_type")
            .order_by("session_id", "created_at")
        )
        days_param = request.query_params.get("days")
        if days_param:
            try:
                since = timezone.now() - timedelta(days=int(days_param))
                qs = qs.filter(created_at__gte=since)
            except (ValueError, TypeError):
                pass

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
        from datetime import timedelta

        from apps.users.models import User
        from apps.community.models import Post as CPost, Comment as CComment
        from apps.networks.models import Post as NPost, Comment as NComment

        since = None
        days_param = request.query_params.get("days")
        if days_param:
            try:
                days = max(1, min(90, int(days_param)))
                since = timezone.now() - timedelta(days=days)
            except (ValueError, TypeError):
                pass

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
        if since is not None:
            c_post_qs = c_post_qs.filter(created_at__gte=since)
            n_post_qs = n_post_qs.filter(created_at__gte=since)
            c_comment_qs = c_comment_qs.filter(created_at__gte=since)
            n_comment_qs = n_comment_qs.filter(created_at__gte=since)

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
        if since is not None:
            like_log_qs = like_log_qs.filter(created_at__gte=since)
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
        if since is not None:
            comment_log_qs = comment_log_qs.filter(created_at__gte=since)
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

        # session_id 있고 section 있는 page_view 로그만
        qs = (
            EventLog.objects
            .filter(
                event_type="page_view",
                session_id__isnull=False,
                section__isnull=False,
            )
            .values("session_id", "section", "created_at")
            .order_by("session_id", "created_at")
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
            EventLog.objects
            .filter(event_type="page_view", section__isnull=False)
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
