import api from "./axios";

// ─── 페이지뷰 전송 (세션/체류시간 집계용, session_id 필수) ───
const PAGE_VIEW_SECTIONS = ["home", "community", "network", "department"] as const;
export function getPageViewSection(pathname: string): (typeof PAGE_VIEW_SECTIONS)[number] | null {
  if (!pathname || pathname === "/") return "home";
  if (pathname.startsWith("/community")) return "community";
  if (pathname.startsWith("/network")) return "network";
  if (pathname.startsWith("/department")) return "department";
  return null;
}
export function sendPageView(
  section: string,
  page?: string,
  sessionId?: string,
  sessionTouch?: { utm_source?: string; referrer_host?: string },
) {
  if (!sessionId) return Promise.resolve();
  return api.post("logs/page-view/", {
    section,
    page: page || `/${section}`,
    session_id: sessionId,
    // 이번 방문의 유입 경로 (세션 첫 페이지 기준)
    utm_source: sessionTouch?.utm_source,
    referrer_host: sessionTouch?.referrer_host,
  });
}

// ─── 프론트에서만 알 수 있는 행동 이벤트 (DB 저장) ───
export type TrackEventPayload =
  | { event_type: "login_wall_view"; from?: string | null; reason?: string | null }
  | { event_type: "write_start"; section: "community" | "network"; post_type?: string }
  | { event_type: "search"; keyword: string };

/** 실패해도 화면 동작에 영향이 없도록 에러를 삼킨다. */
export function sendTrackEvent(payload: TrackEventPayload) {
  return api.post("logs/track/", payload).catch(() => {});
}

// ─── 대시보드 KPI (기간별 집계) ───
export interface AnalyticsPeriodParams {
  days?: number;
  start_date?: string;
  end_date?: string;
}

export interface DashboardKpi {
  today_logins: number;
  today_signups: number;
  today_posts: number;
  today_comments: number;
  today_searches: number;
  post_views: number;
  engagements: number;
  engagement_rate: number;
  unique_visitors: number;
  days?: number;
  start_date?: string;
  end_date?: string;
}
export const getDashboardKpi = (params?: AnalyticsPeriodParams) =>
  api.get<DashboardKpi>("logs/analytics/dashboard-kpi/", { params });

// ─── 활성 사용자 지표 (DAU/WAU/MAU · 재방문율 · 주간 유지율) ───
// DailyActiveUser 기반. 기간 선택기와 무관한 '오늘 기준' 고정 윈도우 지표.
// 측정 시작 이전 데이터가 없으므로 status로 집계 가능 여부를 구분한다.
//   ready | partial(측정 시작일이 구간 안 → 과소집계 가능) | pending(계산 불가)
export type MetricStatus = "ready" | "partial" | "pending";

export interface RollingWindowMetric {
  value: number;
  status: MetricStatus;
  window: { start: string; end: string };
  effective_start: string | null;
  days_covered: number;
  days_expected: number;
}

export interface ActiveUserStats {
  as_of: string;
  tracking_since: string | null;
  tracking_days: number;
  timezone: string;

  dau: number;
  wau: RollingWindowMetric;
  mau: RollingWindowMetric;
  dau_mau_ratio: number | null;

  returning_user_rate: {
    status: MetricStatus;
    rate: number | null;
    returning_users: number | null;
    new_users: number | null;
    active_users: number;
  };

  weekly_retention: {
    status: MetricStatus;
    rate: number | null;
    retained_users: number | null;
    last_week_active_users: number | null;
    last_week: { start: string; end: string };
    this_week: { start: string; end: string };
    this_week_in_progress: boolean;
  };
}

export const getActiveUserStats = () =>
  api.get<ActiveUserStats>("logs/analytics/active-users/");

// ─── 비활성 사용자 복귀 분석 ───
// "정책 시행 전 N일간 안 오던 기존 회원이, 시행 후 M일 안에 다시 왔는가?"
// 대시보드 전역 기간 선택기와 무관하게 자체 파라미터로만 동작한다.
export type ReactivationUnavailableReason =
  | "policy_date_in_future"
  | "inactive_window_not_tracked"
  | "no_inactive_users";

export interface ReactivationAnalysis {
  as_of: string;
  policy_date: string;
  tracking_since: string | null;

  inactive_window: {
    start: string;
    end: string;
    days: number;
    effective_start: string | null;
    days_covered: number;
  };
  observation_window: {
    start: string;
    end: string;
    days: number;
    days_elapsed: number;
  };

  eligible_users: number;
  inactive_users: number | null;
  returned_users: number | null;
  reactivation_rate: number | null;

  status: MetricStatus;
  observation_in_progress: boolean;
  unavailable_reason?: ReactivationUnavailableReason;
}

export const getReactivationAnalysis = (params: {
  policy_date: string;
  inactive_days?: number;
  observation_days?: number;
}) => api.get<ReactivationAnalysis>("logs/analytics/reactivation/", { params });

// ─── 운영 로그 (EventLog 목록) ───
export interface OperationalLogItem {
  id: number;
  created_at: string | null;
  event_type: string;
  section: string | null;
  page: string | null;
  user_type: string | null;
  grade_at_event: number | null;
  search_keyword: string | null;
  details: string;
}
export const getOperationalLogs = (params?: {
  page?: number;
  page_size?: number;
  event_type?: string;
  q?: string;
}) =>
  api.get<{
    results: OperationalLogItem[];
    count: number;
    page: number;
    page_size: number;
  }>("logs/analytics/operational-logs/", { params });

// ─── Heatmap ───
export interface HeatmapRow {
  author_grade: number | string;
  author_grade_label: string;
  cols: { viewer_grade: number | string; viewer_grade_label: string; score: number }[];
}
export const getHeatmap = (params?: AnalyticsPeriodParams) =>
  api.get<{ rows: HeatmapRow[] }>("logs/analytics/heatmap/", { params });

// ─── 학년별 인기 글 ───
export interface PopularByGradePost {
  post_id: number;
  section: string;
  title: string;
  score: number;
}
export interface PopularByGradeGroup {
  viewer_grade: number;
  viewer_grade_label: string;
  posts: PopularByGradePost[];
}
export const getPopularByGrade = (params?: AnalyticsPeriodParams & { top_n?: number }) =>
  api.get<{ by_grade: PopularByGradeGroup[] }>(
    "logs/analytics/popular-by-grade/",
    { params }
  );

// ─── 관심분야별 인기 글 (post_view) ───
export interface PopularByInterestPost {
  post_id: number;
  title: string;
  view_count: number;
}
export interface PopularByInterestGroup {
  interest: string;
  interest_label: string;
  posts: PopularByInterestPost[];
}
export const getPopularByInterest = (params?: AnalyticsPeriodParams & {
  section?: string;
  top_n?: number;
}) =>
  api.get<{ section: string; by_interest: PopularByInterestGroup[] }>(
    "logs/analytics/popular-by-interest/",
    { params }
  );

// ─── 게시글별 학년×관심분야 조회 ───
export interface PostSegmentItem {
  rank: number;
  grade_group: number;
  grade_label: string;
  interest: string;
  interest_label: string;
  view_count: number;
}
export interface PostSegmentViewPost {
  post_id: number;
  title: string;
  total_views: number;
  primary_segment: PostSegmentItem | null;
  top_segments: PostSegmentItem[];
}
export const getPostSegmentViews = (params?: AnalyticsPeriodParams & {
  section?: string;
  top_posts?: number;
  top_segments?: number;
}) =>
  api.get<{
    section: string;
    days?: number;
    start_date?: string;
    end_date?: string;
    posts: PostSegmentViewPost[];
  }>(
    "logs/analytics/post-segment-views/",
    { params }
  );

// ─── Page visitors ───
export interface PageVisitorItem {
  section: string;
  section_label: string;
  count: number;
}
export const getPageVisitors = (params?: AnalyticsPeriodParams) =>
  api.get<{ by_section: PageVisitorItem[] }>("logs/analytics/page-visitors/", {
    params,
  });

// ─── Knowledge delivery score ───
export interface KnowledgeScoreItem {
  grade_key: number | string;
  grade_label: string;
  post_count: number;
  comment_count: number;
  received_likes: number;
  post_score: number;
  comment_score: number;
  like_score: number;
  total_score: number;
}
export const getKnowledgeDeliveryScore = (params?: AnalyticsPeriodParams) =>
  api.get<{ by_grade: KnowledgeScoreItem[] }>(
    "logs/analytics/knowledge-delivery-score/",
    { params }
  );

// ─── User management ───
export interface UserManagementUser {
  id: number;
  user_type: "student" | "graduate";
  nickname: string;
  grade: number | null;
  interests: string[];
  post_count: number;
  comment_count: number;
  score: number;
}
/** grade: [1,2], interest: ["ai","data"] → ?grade=1&grade=2&interest=ai&interest=data */
export const getUsers = (params?: {
  grade?: number[];
  interest?: string[];
  user_type?: "student" | "graduate";
}) =>
  api.get<{ users: UserManagementUser[]; count: number }>(
    "logs/analytics/user-management/",
    {
      params,
      // 기본 axios 배열 직렬화(foo[]=1&foo[]=2)가 아니라
      // DRF getlist("grade")가 읽을 수 있게 grade=1&grade=2 형태로 보냄
      paramsSerializer: (p) => {
        const search = new URLSearchParams();
        const grade = (p as any)?.grade as number[] | undefined;
        const interest = (p as any)?.interest as string[] | undefined;

        const userType = (p as any)?.user_type as
          | "student"
          | "graduate"
          | undefined;
        if (userType) search.append("user_type", userType);

        grade?.forEach((g) => search.append("grade", String(g)));
        interest?.forEach((i) => search.append("interest", i));

        return search.toString();
      },
    }
  );

// ─── Error logs ───
export interface ErrorLogItem {
  id: number;
  created_at: string | null;
  path: string;
  method: string;
  status_code: number;
  message: string;
}
export const getErrorLogs = (params?: {
  q?: string;
  status_code?: number;
  page?: number;
  page_size?: number;
}) =>
  api.get<{
    results: ErrorLogItem[];
    count: number;
    page: number;
    page_size: number;
  }>("logs/analytics/errors/", { params });

export interface ErrorStats {
  today_count: number;
  trend: { hour: number; count: number }[];
  avg_response_time_ms: number | null;
  total_requests: number;
}
export const getErrorLogStats = () =>
  api.get<ErrorStats>("logs/analytics/errors/stats/");

// ─── Event settings ───
export interface EventSettingItem {
  event_type: string;
  category: string;
  is_active: boolean;
  log_count: number;
}
export const getEventSettings = () =>
  api.get<{ results: EventSettingItem[] }>("logs/event-settings/");

export const toggleEventSetting = (
  eventType: string,
  isActive: boolean
) =>
  api.patch<{
    event_type: string;
    category: string;
    is_active: boolean;
  }>(`logs/event-settings/${eventType}/`, { is_active: isActive });

// ─── Search ranking ───
export interface SearchRankingItem {
  rank: number;
  keyword: string;
  count: number;
  main_grade: number | null;
  main_grade_label: string;
  main_interest: string | null;
  main_interest_label: string;
}
export const getSearchRanking = (params?: AnalyticsPeriodParams & {
  section?: string;
  top_n?: number;
  interest?: string;
}) =>
  api.get<{
    total_search_count: number;
    ranking: SearchRankingItem[];
  }>("logs/analytics/search-ranking/", { params });

// ─── Session stats ───
export interface SessionStats {
  average_session_seconds: number;
  average_session_display: string;
  total_sessions: number;
}
export const getSessionStats = (params?: AnalyticsPeriodParams) =>
  api.get<SessionStats>("logs/analytics/session-stats/", { params });

// ─── Session analytics (학년별 평균 세션 시간 + 세션 시간 분포) ───
export interface SessionByGrade {
  grade_key: number | string;
  grade_label: string;
  average_minutes: number;
  session_count: number;
}
export interface SessionDistributionBucket {
  bucket: string;
  count: number;
}
export const getSessionAnalytics = (params?: AnalyticsPeriodParams) =>
  api.get<{
    by_grade: SessionByGrade[];
    distribution: SessionDistributionBucket[];
  }>("logs/analytics/session-analytics/", { params });

// ─── Session journey (사용자 여정맵) ───
export interface SessionTransition {
  from_section: string;
  from_label: string;
  to_section: string;
  to_label: string;
  count: number;
}
export interface SectionVisit {
  section: string;
  label: string;
  visits: number;
}
export const getSessionJourney = (params?: AnalyticsPeriodParams & { top_n?: number }) =>
  api.get<{ transitions: SessionTransition[]; section_visits: SectionVisit[] }>(
    "logs/analytics/session-journey/",
    { params }
  );

export interface AdminInsight {
  summary: string;
  key_findings: string[];
  action_items: { priority: "high" | "medium" | "low"; action: string; reason: string }[];
  metrics_highlight: Record<string, string>;
}

export const getAdminInsights = (params?: AnalyticsPeriodParams) =>
  api.get<{ period: Record<string, string | number>; insight: AdminInsight }>(
    "logs/analytics/insights/",
    { params }
  );
