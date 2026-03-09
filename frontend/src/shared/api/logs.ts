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
export function sendPageView(section: string, page?: string, sessionId?: string) {
  if (!sessionId) return Promise.resolve();
  return api.post("logs/page-view/", {
    section,
    page: page || `/${section}`,
    session_id: sessionId,
  });
}

// ─── 대시보드 KPI (기간별 집계, days=1|7|30) ───
export interface DashboardKpi {
  today_logins: number;
  today_signups: number;
  today_posts: number;
  today_comments: number;
  today_searches: number;
  unique_visitors: number;
  days?: number;
}
export const getDashboardKpi = (params?: { days?: number }) =>
  api.get<DashboardKpi>("logs/analytics/dashboard-kpi/", { params });

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
export const getHeatmap = () =>
  api.get<{ rows: HeatmapRow[] }>("logs/analytics/heatmap/");

// ─── Page visitors ───
export interface PageVisitorItem {
  section: string;
  section_label: string;
  count: number;
}
export const getPageVisitors = (params?: { days?: number }) =>
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
export const getKnowledgeDeliveryScore = (params?: { days?: number }) =>
  api.get<{ by_grade: KnowledgeScoreItem[] }>(
    "logs/analytics/knowledge-delivery-score/",
    { params }
  );

// ─── User management ───
export interface UserManagementUser {
  id: number;
  nickname: string;
  grade: number | null;
  interests: string[];
  post_count: number;
  comment_count: number;
}
/** grade: [1,2], interest: ["ai","data"] → ?grade=1&grade=2&interest=ai&interest=data */
export const getUsers = (params?: { grade?: number[]; interest?: string[] }) =>
  api.get<{ users: UserManagementUser[]; count: number }>(
    "logs/analytics/user-management/",
    { params }
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
export const getSearchRanking = (params?: {
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
export const getSessionStats = (params?: { days?: number }) =>
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
export const getSessionAnalytics = (params?: { days?: number }) =>
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
export const getSessionJourney = (params?: { top_n?: number }) =>
  api.get<{ transitions: SessionTransition[]; section_visits: SectionVisit[] }>(
    "logs/analytics/session-journey/",
    { params }
  );
