"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Shield,
  Search,
  Filter,
  Lock,
  LayoutDashboard,
  FileText,
  BarChart3,
  Activity,
  Users,
  LogIn,
  UserPlus,
  MessageSquare,
  Mail,
  Eye,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  Settings,
  TrendingDown,
  X,
  Copy,
  ChevronDown,
  ChevronUp,
  Clock,
  Map,
  Download,
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  Bell,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import api from "@/shared/api/axios";
import {
  getSiteNoticesAdmin,
  createSiteNotice,
  updateSiteNotice,
  deleteSiteNotice,
  type SiteNoticeItem,
  type SiteNoticePayload,
} from "@/shared/api/announcements";
import {
  getHeatmap,
  getPageVisitors,
  getKnowledgeDeliveryScore,
  getUsers,
  getErrorLogs,
  getErrorLogStats,
  getEventSettings,
  toggleEventSetting,
  getSearchRanking,
  getSessionStats,
  getDashboardKpi,
  getOperationalLogs,
  getSessionAnalytics,
  type HeatmapRow,
  type PageVisitorItem,
  type KnowledgeScoreItem,
  type UserManagementUser,
  type ErrorLogItem,
  type ErrorStats,
  type EventSettingItem,
  type SearchRankingItem,
  type SessionStats,
  type SessionByGrade,
  type SessionDistributionBucket,
  type DashboardKpi,
  type OperationalLogItem,
} from "@/shared/api/logs";

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────
type ViewType =
  | "dashboard"
  | "operational"
  | "analytics"
  | "errors"
  | "eventConfig"
  | "userManagement"
  | "searchAnalytics"
  | "sessions"
  | "announcements";

// 이벤트 상세 패널용 타입 (EventDetailPanel에서 사용)
interface OperationalLog {
  id: number;
  timestamp: string;
  eventType: string;
  page: string;
  userType: "student" | "graduate";
  grade?: string;
  details: string;
  eventId?: string;
  userId?: string;
  anonymousId?: string;
  sessionId?: string;
  referrer?: string;
  device?: string;
  properties?: Record<string, unknown>;
}

// 학년 숫자 → 라벨 (백엔드 grade: 1,2,3,4 / 34 / "graduate")
function gradeToLabel(g: number | string | null): string {
  if (g === null || g === undefined) return "-";
  if (g === 34) return "3~4학년";
  if (g === "graduate") return "졸업생";
  if (typeof g === "number" && 1 <= g && g <= 4) return `${g}학년`;
  return String(g);
}
// 관심분야 코드 → 라벨
function interestToLabel(i: string): string {
  const map: Record<string, string> = { ai: "AI", data: "데이터", business: "경영" };
  return map[i] || i;
}

// 이벤트 설정 카테고리 → 한글
const EVENT_CATEGORY_LABEL: Record<string, string> = {
  navigation: "탐색",
  authentication: "인증",
  content: "콘텐츠",
  engagement: "참여",
  discovery: "발견",
};
function eventCategoryToLabel(cat: string): string {
  const ko = EVENT_CATEGORY_LABEL[cat];
  return ko ? `${cat} (${ko})` : cat;
}

// ──────────────────────────────────────────
// 헬퍼 함수
// ──────────────────────────────────────────
function getEventTypeColor(type: string) {
  if (type.includes("login")) return "bg-blue-100 text-blue-700";
  if (type.includes("signup")) return "bg-green-100 text-green-700";
  if (type.includes("post")) return "bg-purple-100 text-purple-700";
  if (type.includes("comment")) return "bg-orange-100 text-orange-700";
  if (type.includes("search")) return "bg-pink-100 text-pink-700";
  if (type.includes("message")) return "bg-indigo-100 text-indigo-700";
  if (type.includes("error")) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-700";
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case "low": return "bg-blue-100 text-blue-700";
    case "medium": return "bg-yellow-100 text-yellow-700";
    case "high": return "bg-orange-100 text-orange-700";
    case "critical": return "bg-red-100 text-red-700";
    default: return "bg-gray-100 text-gray-700";
  }
}

function getGradeBadgeColor(grade: string) {
  switch (grade) {
    case "1학년": return "bg-blue-100 text-blue-700";
    case "2학년": return "bg-green-100 text-green-700";
    case "3학년":
    case "4학년":
    case "3-4학년": return "bg-purple-100 text-purple-700";
    case "졸업생": return "bg-orange-100 text-orange-700";
    default: return "bg-gray-100 text-gray-700";
  }
}

function getInterestBadgeColor(interest: string) {
  switch (interest) {
    case "AI": return "bg-purple-100 text-purple-700";
    case "데이터": return "bg-blue-100 text-blue-700";
    case "경영": return "bg-green-100 text-green-700";
    default: return "bg-gray-100 text-gray-700";
  }
}

// ──────────────────────────────────────────
// 이벤트 상세 패널
// ──────────────────────────────────────────
function EventDetailPanel({ log, onClose }: { log: OperationalLog; onClose: () => void }) {
  const [jsonExpanded, setJsonExpanded] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-lg text-gray-900">이벤트 상세 정보</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Event ID</label>
              <div className="mt-1 flex items-center gap-2">
                <code className="text-sm font-mono text-gray-900">{log.eventId}</code>
                <button onClick={() => copyToClipboard(log.eventId || "")} className="p-1 hover:bg-gray-100 rounded">
                  <Copy className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Event Name</label>
              <div className="mt-1">
                <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${getEventTypeColor(log.eventType)}`}>
                  {log.eventType}
                </span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">User ID</label>
              <div className="mt-1 flex items-center gap-2">
                <code className="text-sm font-mono text-gray-900">{log.userId}</code>
                <button onClick={() => copyToClipboard(log.userId || "")} className="p-1 hover:bg-gray-100 rounded">
                  <Copy className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Session ID</label>
              <div className="mt-1 flex items-center gap-2">
                <code className="text-sm font-mono text-gray-900">{log.sessionId}</code>
                <button onClick={() => copyToClipboard(log.sessionId || "")} className="p-1 hover:bg-gray-100 rounded">
                  <Copy className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Timestamp</label>
              <div className="mt-1 text-sm text-gray-900">{log.timestamp}</div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Device</label>
              <div className="mt-1 text-sm text-gray-900">{log.device}</div>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Page Path</label>
              <div className="mt-1 text-sm font-mono text-gray-900">{log.page}</div>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Referrer</label>
              <div className="mt-1 text-sm text-gray-900">{log.referrer || "Direct"}</div>
            </div>
          </div>
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Event Properties</label>
              <button
                onClick={() => setJsonExpanded(!jsonExpanded)}
                className="text-xs text-[#2563EB] hover:underline flex items-center gap-1"
              >
                {jsonExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {jsonExpanded ? "축소" : "확장"}
              </button>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 overflow-auto">
              <pre className="text-xs text-green-400 font-mono">
                {JSON.stringify(log.properties, null, jsonExpanded ? 2 : 0)}
              </pre>
            </div>
            <button
              onClick={() => copyToClipboard(JSON.stringify(log.properties, null, 2))}
              className="mt-2 text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              <Copy className="w-3 h-3" />
              Copy JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 운영 로그(API) 상세 패널
function OperationalLogDetailPanel({ log, onClose }: { log: OperationalLogItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-lg text-gray-900">운영 로그 상세</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</label>
              <div className="mt-1 text-sm font-mono text-gray-900">{log.id}</div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">발생 시각</label>
              <div className="mt-1 text-sm text-gray-900">{log.created_at ? new Date(log.created_at).toLocaleString("ko-KR") : "-"}</div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">이벤트</label>
              <div className="mt-1">
                <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${getEventTypeColor(log.event_type)}`}>{log.event_type}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">섹션</label>
              <div className="mt-1 text-sm text-gray-900">{log.section ?? "-"}</div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">페이지</label>
              <div className="mt-1 text-sm font-mono text-gray-900">{log.page ?? "-"}</div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">사용자 유형</label>
              <div className="mt-1 text-sm text-gray-900">{log.user_type ?? "-"}</div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">학년</label>
              <div className="mt-1 text-sm text-gray-900">{log.grade_at_event != null ? gradeToLabel(log.grade_at_event) : "-"}</div>
            </div>
            {log.event_type === "search" && (
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">검색어</label>
                <div className="mt-1 text-sm text-gray-900">{log.search_keyword ?? "-"}</div>
              </div>
            )}
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">상세</label>
              <div className="mt-1 text-sm text-gray-600">{log.details}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// 메인 관리자 페이지
// ──────────────────────────────────────────
export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewType>("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [selectedLog, setSelectedLog] = useState<OperationalLog | null>(null);
  const [selectedOperationalLog, setSelectedOperationalLog] = useState<OperationalLogItem | null>(null);
  const [dashboardKpi, setDashboardKpi] = useState<DashboardKpi | null>(null);
  const [loadingDashboardKpi, setLoadingDashboardKpi] = useState(false);
  const [operationalLogs, setOperationalLogs] = useState<OperationalLogItem[]>([]);
  const [operationalLogsCount, setOperationalLogsCount] = useState(0);
  const [operationalLogsPage, setOperationalLogsPage] = useState(1);
  const [operationalLogsPageSize] = useState(20);
  const [loadingOperationalLogs, setLoadingOperationalLogs] = useState(false);
  const [errorSeverityFilter, setErrorSeverityFilter] = useState("all");
  const [interestFilter, setInterestFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [searchInterestFilter, setSearchInterestFilter] = useState("all");
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [broadcastContent, setBroadcastContent] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastError, setBroadcastError] = useState("");
  const [broadcastToCurrentList, setBroadcastToCurrentList] = useState(false);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [notificationContent, setNotificationContent] = useState("");
  const [notificationToCurrentList, setNotificationToCurrentList] = useState(false);
  const [notificationSending, setNotificationSending] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [dashboardDays, setDashboardDays] = useState<1 | 7 | 30>(1);
  const [siteNotices, setSiteNotices] = useState<SiteNoticeItem[]>([]);
  const [loadingSiteNotices, setLoadingSiteNotices] = useState(false);
  const [noticeModalOpen, setNoticeModalOpen] = useState(false);
  const [noticeEditing, setNoticeEditing] = useState<SiteNoticeItem | null>(null);
  const [noticeForm, setNoticeForm] = useState<SiteNoticePayload>({
    title: "",
    content: "",
    link: "",
    image_url: "",
    notice_type: "notice",
    is_active: true,
    order: 0,
  });
  const [noticeSaving, setNoticeSaving] = useState(false);
  const [noticeError, setNoticeError] = useState("");

  // API 데이터
  const [heatmapRows, setHeatmapRows] = useState<HeatmapRow[]>([]);
  const [pageVisitors, setPageVisitors] = useState<PageVisitorItem[]>([]);
  const [knowledgeScores, setKnowledgeScores] = useState<KnowledgeScoreItem[]>([]);
  const [usersList, setUsersList] = useState<UserManagementUser[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLogItem[]>([]);
  const [errorStats, setErrorStats] = useState<ErrorStats | null>(null);
  const [eventSettings, setEventSettings] = useState<EventSettingItem[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchRanking, setSearchRanking] = useState<SearchRankingItem[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [sessionByGrade, setSessionByGrade] = useState<SessionByGrade[]>([]);
  const [sessionDistribution, setSessionDistribution] = useState<SessionDistributionBucket[]>([]);
  const [loadingSessionAnalytics, setLoadingSessionAnalytics] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [errorPage, setErrorPage] = useState(1);
  const [errorPageSize] = useState(20);

  useEffect(() => {
    api
      .get("users/me/")
      .then((res) => {
        setIsAdmin(res.data.is_staff === true);
      })
      .catch(() => {
        setIsAdmin(false);
      })
      .finally(() => setAuthLoading(false));
  }, []);

  // 행동 분석
  useEffect(() => {
    if (!isAdmin || currentView !== "analytics") return;
    setLoadingAnalytics(true);
    Promise.all([
      getHeatmap().then((r) => r.data.rows),
      getPageVisitors().then((r) => r.data.by_section),
      getKnowledgeDeliveryScore().then((r) => r.data.by_grade),
    ])
      .then(([rows, bySection, byGrade]) => {
        setHeatmapRows(rows);
        setPageVisitors(bySection);
        setKnowledgeScores(byGrade);
      })
      .catch(() => {})
      .finally(() => setLoadingAnalytics(false));
  }, [isAdmin, currentView]);

  // 에러 모니터링
  useEffect(() => {
    if (!isAdmin || currentView !== "errors") return;
    setLoadingErrors(true);
    Promise.all([
      getErrorLogs({ page: errorPage, page_size: errorPageSize, q: searchTerm || undefined }).then((r) => r.data),
      getErrorLogStats().then((r) => r.data),
    ])
      .then(([listRes, stats]) => {
        setErrorLogs(listRes.results);
        setErrorStats(stats);
      })
      .catch(() => {})
      .finally(() => setLoadingErrors(false));
  }, [isAdmin, currentView, errorPage, searchTerm]);

  // 유저 관리
  useEffect(() => {
    if (!isAdmin || currentView !== "userManagement") return;
    setLoadingUsers(true);
    const grade = gradeFilter !== "all" ? [Number(gradeFilter.replace("학년", ""))] : undefined;
    const interest = interestFilter !== "all" ? (interestFilter === "AI" ? ["ai"] : interestFilter === "데이터" ? ["data"] : ["business"]) : undefined;
    getUsers({ grade, interest })
      .then((r) => setUsersList(r.data.users))
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, [isAdmin, currentView, gradeFilter, interestFilter]);

  // 이벤트 설정
  useEffect(() => {
    if (!isAdmin || currentView !== "eventConfig") return;
    setLoadingEvents(true);
    getEventSettings()
      .then((r) => setEventSettings(r.data.results))
      .catch(() => {})
      .finally(() => setLoadingEvents(false));
  }, [isAdmin, currentView]);

  // 검색 분석
  useEffect(() => {
    if (!isAdmin || currentView !== "searchAnalytics") return;
    setLoadingSearch(true);
    const interest = searchInterestFilter === "all" ? undefined : searchInterestFilter === "AI" ? "ai" : searchInterestFilter === "데이터" ? "data" : "business";
    getSearchRanking({ top_n: 10, interest })
      .then((r) => {
        setSearchTotal(r.data.total_search_count);
        setSearchRanking(r.data.ranking);
      })
      .catch(() => {})
      .finally(() => setLoadingSearch(false));
  }, [isAdmin, currentView, searchInterestFilter]);

  // 세션 분석
  useEffect(() => {
    if (!isAdmin || currentView !== "sessions") return;
    setLoadingSession(true);
    setLoadingSessionAnalytics(true);
    getSessionStats({ days: 30 })
      .then((r) => setSessionStats(r.data))
      .catch(() => {})
      .finally(() => setLoadingSession(false));
    getSessionAnalytics({ days: 30 })
      .then((r) => {
        setSessionByGrade(r.data.by_grade);
        setSessionDistribution(r.data.distribution);
      })
      .catch(() => {})
      .finally(() => setLoadingSessionAnalytics(false));
  }, [isAdmin, currentView]);

  // 대시보드 KPI + 페이지방문 + 지식전달
  useEffect(() => {
    if (!isAdmin || currentView !== "dashboard") return;
    setLoadingDashboardKpi(true);
    const days = dashboardDays;
    Promise.all([
      getDashboardKpi({ days }).then((r) => r.data),
      getPageVisitors({ days }).then((r) => r.data.by_section),
      getKnowledgeDeliveryScore({ days }).then((r) => r.data.by_grade),
    ])
      .then(([kpi, bySection, byGrade]) => {
        setDashboardKpi(kpi);
        setPageVisitors(bySection);
        setKnowledgeScores(byGrade);
      })
      .catch(() => setDashboardKpi(null))
      .finally(() => setLoadingDashboardKpi(false));
  }, [isAdmin, currentView, dashboardDays]);

  // 운영 로그 목록 (event_type: all->빈값, post->post_create)
  const operationalEventType =
    filterType === "all" ? undefined : filterType === "post" ? "post_create" : filterType;
  useEffect(() => {
    if (!isAdmin || currentView !== "operational") return;
    setLoadingOperationalLogs(true);
    getOperationalLogs({
      page: operationalLogsPage,
      page_size: operationalLogsPageSize,
      event_type: operationalEventType,
      q: searchTerm.trim() || undefined,
    })
      .then((r) => {
        setOperationalLogs(r.data.results);
        setOperationalLogsCount(r.data.count);
      })
      .catch(() => {
        setOperationalLogs([]);
        setOperationalLogsCount(0);
      })
      .finally(() => setLoadingOperationalLogs(false));
  }, [isAdmin, currentView, operationalLogsPage, operationalLogsPageSize, operationalEventType, searchTerm]);

  useEffect(() => {
    if (currentView !== "operational") return;
    setOperationalLogsPage(1);
  }, [searchTerm, filterType, currentView]);

  // 공지/배너 목록
  useEffect(() => {
    if (!isAdmin || currentView !== "announcements") return;
    setLoadingSiteNotices(true);
    getSiteNoticesAdmin()
      .then((r) => {
        const raw = r.data as SiteNoticeItem[] | { results: SiteNoticeItem[] };
        const list = Array.isArray(raw) ? raw : (raw as { results: SiteNoticeItem[] }).results ?? [];
        setSiteNotices(list);
      })
      .catch(() => setSiteNotices([]))
      .finally(() => setLoadingSiteNotices(false));
  }, [isAdmin, currentView]);

  const openNoticeCreate = () => {
    setNoticeEditing(null);
    setNoticeForm({
      title: "",
      content: "",
      link: "",
      image_url: "",
      notice_type: "notice",
      is_active: true,
      order: siteNotices.length,
    });
    setNoticeError("");
    setNoticeModalOpen(true);
  };
  const openNoticeEdit = (item: SiteNoticeItem) => {
    setNoticeEditing(item);
    setNoticeForm({
      title: item.title,
      content: item.content ?? "",
      link: item.link ?? "",
      image_url: item.image_url ?? "",
      notice_type: item.notice_type,
      starts_at: item.starts_at ?? undefined,
      ends_at: item.ends_at ?? undefined,
      is_active: item.is_active,
      order: item.order,
    });
    setNoticeError("");
    setNoticeModalOpen(true);
  };
  const closeNoticeModal = () => {
    setNoticeModalOpen(false);
    setNoticeEditing(null);
    setNoticeError("");
  };
  const handleNoticeSave = async () => {
    if (!noticeForm.title.trim()) {
      setNoticeError("제목을 입력하세요.");
      return;
    }
    setNoticeSaving(true);
    setNoticeError("");
    try {
      const payload: SiteNoticePayload = {
        title: noticeForm.title.trim(),
        content: noticeForm.content?.trim() || "",
        link: noticeForm.link?.trim() || "",
        image_url: noticeForm.image_url?.trim() || "",
        notice_type: noticeForm.notice_type,
        is_active: noticeForm.is_active,
        order: noticeForm.order ?? 0,
      };
      if (noticeForm.starts_at) payload.starts_at = noticeForm.starts_at;
      if (noticeForm.ends_at) payload.ends_at = noticeForm.ends_at;
      if (noticeEditing) {
        await updateSiteNotice(noticeEditing.id, payload);
        setSiteNotices((prev) =>
          prev.map((n) => (n.id === noticeEditing.id ? { ...n, ...payload } : n))
        );
      } else {
        const res = await createSiteNotice(payload);
        const created = res.data as SiteNoticeItem;
        setSiteNotices((prev) => [created, ...prev]);
      }
      closeNoticeModal();
    } catch (err: unknown) {
      const data = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data
        : null;
      setNoticeError(data?.detail ?? "저장에 실패했습니다.");
    } finally {
      setNoticeSaving(false);
    }
  };
  const handleNoticeDelete = async (id: number) => {
    if (!confirm("이 공지/배너를 삭제할까요?")) return;
    try {
      await deleteSiteNotice(id);
      setSiteNotices((prev) => prev.filter((n) => n.id !== id));
    } catch {
      alert("삭제에 실패했습니다.");
    }
  };

  const filteredErrors = errorLogs.filter((error) => {
    const matchesSearch =
      !searchTerm || error.path.includes(searchTerm) || error.message.includes(searchTerm);
    if (errorSeverityFilter === "all") return matchesSearch;
    const severity = error.status_code >= 500 ? "high" : "low";
    return matchesSearch && severity === errorSeverityFilter;
  });

  const handleEventToggle = async (eventType: string, isActive: boolean) => {
    try {
      await toggleEventSetting(eventType, isActive);
      setEventSettings((prev) =>
        prev.map((s) => (s.event_type === eventType ? { ...s, is_active: isActive } : s))
      );
    } catch {
      // keep UI state
    }
  };

  const handleExportCsv = () => {
    const periodLabel = dashboardDays === 1 ? "오늘" : dashboardDays === 7 ? "지난 7일" : "지난 30일";
    const rows: string[][] = [
      ["AIVE 대시보드 내보내기", ""],
      ["기간", periodLabel],
      ["내보낸 시각", new Date().toLocaleString("ko-KR")],
      [],
      ["KPI", ""],
      ["순 방문자", String(dashboardKpi?.unique_visitors ?? 0)],
      ["로그인", String(dashboardKpi?.today_logins ?? 0)],
      ["가입", String(dashboardKpi?.today_signups ?? 0)],
      ["작성된 글", String(dashboardKpi?.today_posts ?? 0)],
      ["댓글", String(dashboardKpi?.today_comments ?? 0)],
      ["검색", String(dashboardKpi?.today_searches ?? 0)],
      [],
      ["페이지 방문수", "방문수"],
      ...pageVisitors.map((v) => [v.section_label, String(v.count)]),
      [],
      ["지식 전달 점수", "글수", "댓글수", "받은좋아요", "글점수", "댓글점수", "좋아요점수", "총점"],
      ...knowledgeScores.map((k) => [
        k.grade_label,
        String(k.post_count),
        String(k.comment_count),
        String(k.received_likes),
        String(k.post_score),
        String(k.comment_score),
        String(k.like_score),
        String(k.total_score),
      ]),
    ];
    const escape = (s: string) => {
      const t = String(s);
      if (t.includes(",") || t.includes('"') || t.includes("\n")) return `"${t.replace(/"/g, '""')}"`;
      return t;
    };
    const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aive-dashboard-${dashboardDays}days-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleNotificationBroadcast = async () => {
    const message = notificationContent.trim();
    if (!message) {
      setNotificationError("메시지를 입력하세요.");
      return;
    }
    setNotificationSending(true);
    setNotificationError("");
    try {
      const payload: { message: string; user_ids?: number[] } = { message };
      if (notificationToCurrentList && usersList.length > 0) {
        payload.user_ids = usersList.map((u) => u.id);
      }
      const res = await api.post("notifications/broadcast/", payload);
      const msg = res.data?.detail ?? `${res.data?.sent_count ?? 0}명에게 알림을 보냈습니다.`;
      alert(msg);
      setNotificationModalOpen(false);
      setNotificationContent("");
    } catch (err: unknown) {
      const data = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data
        : null;
      setNotificationError(data?.detail ?? "알림 발송에 실패했습니다.");
    } finally {
      setNotificationSending(false);
    }
  };

  const handleBroadcastSubmit = async () => {
    const content = broadcastContent.trim();
    if (!content) {
      setBroadcastError("내용을 입력해주세요.");
      return;
    }
    setBroadcastSending(true);
    setBroadcastError("");
    try {
      const payload: { content: string; user_ids?: number[] } = { content };
      if (broadcastToCurrentList && usersList.length > 0) {
        payload.user_ids = usersList.map((u) => u.id);
      }
      const res = await api.post("messages/admin-broadcast/", payload);
      const msg = res.data?.detail ?? `${res.data?.sent_count ?? 0}명에게 쪽지를 보냈습니다.`;
      alert(msg);
      setBroadcastModalOpen(false);
      setBroadcastContent("");
    } catch (err: unknown) {
      const data = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data
        : null;
      setBroadcastError(data?.detail ?? "쪽지 발송에 실패했습니다.");
    } finally {
      setBroadcastSending(false);
    }
  };

  // ── 로딩 ──
  if (authLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── 접근 불가 ──
  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="mb-8 flex items-center justify-center">
            <div className="w-16 h-16 bg-gradient-to-br from-[#2563EB] to-[#8B5CF6] rounded-2xl flex items-center justify-center shadow-lg">
              <Shield className="w-9 h-9 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">AIVE Admin Dashboard</h1>
          <p className="text-gray-600 mb-8">AI & Big Data 융합경영학과 관리자 대시보드</p>
          <div className="bg-gray-50 rounded-2xl p-8 border border-gray-200">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-gray-900">접근 권한이 없습니다</h2>
            <p className="text-gray-600 mb-6">이 페이지는 관리자만 접근할 수 있습니다.</p>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-gradient-to-r from-[#2563EB] to-[#8B5CF6] text-white rounded-xl hover:shadow-lg transition-all font-semibold"
            >
              홈으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── 대시보드 ──
  return (
    <div className="fixed inset-0 z-50 bg-white flex overflow-hidden">
      {/* ── 사이드바 ── */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#2563EB] to-[#8B5CF6] rounded-xl flex items-center justify-center shadow-md">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">AIVE Admin</h2>
              <p className="text-xs text-gray-500">관리자 대시보드</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {(
            [
              { view: "dashboard", label: "대시보드", icon: LayoutDashboard },
              { view: "operational", label: "운영 로그", icon: FileText },
              { view: "analytics", label: "행동 분석", icon: BarChart3 },
              { view: "errors", label: "에러 모니터링", icon: AlertTriangle },
              { view: "eventConfig", label: "이벤트 설정", icon: Settings },
              { view: "userManagement", label: "유저 관리", icon: Users },
              { view: "searchAnalytics", label: "검색 분석", icon: Search },
              { view: "sessions", label: "세션 분석", icon: Clock },
            ] as { view: ViewType; label: string; icon: React.ElementType }[]
          ).map(({ view, label, icon: Icon }) => (
            <button
              key={view}
              onClick={() => setCurrentView(view)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                currentView === view
                  ? "bg-gradient-to-r from-[#2563EB]/10 to-[#8B5CF6]/10 text-[#2563EB] font-semibold"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <Link href="/" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            ← 홈으로 돌아가기
          </Link>
        </div>
      </aside>

      {/* ── 메인 콘텐츠 ── */}
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto p-8">

          {/* ── 대시보드 ── */}
          {currentView === "dashboard" && (
            <>
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">대시보드</h1>
                  <p className="text-gray-600">AIVE 플랫폼 전체 현황</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 rounded-xl border border-gray-200 p-1 bg-white">
                    {([1, 7, 30] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDashboardDays(d)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          dashboardDays === d
                            ? "bg-[#2563EB] text-white"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {d === 1 ? "오늘" : d === 7 ? "지난 7일" : "지난 30일"}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#2563EB] to-[#8B5CF6] text-white rounded-xl hover:shadow-lg transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span className="text-sm font-semibold">Export CSV</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
                {loadingDashboardKpi ? (
                  <div className="col-span-full flex justify-center py-8">
                    <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  [
                    { label: dashboardDays === 1 ? "순 방문자" : "순 방문자", value: dashboardKpi?.unique_visitors ?? 0, icon: Eye, color: "bg-cyan-100", iconColor: "text-cyan-600" },
                    { label: dashboardDays === 1 ? "오늘 로그인" : "로그인", value: dashboardKpi?.today_logins ?? 0, icon: LogIn, color: "bg-blue-100", iconColor: "text-blue-600" },
                    { label: dashboardDays === 1 ? "신규 가입" : "가입", value: dashboardKpi?.today_signups ?? 0, icon: UserPlus, color: "bg-green-100", iconColor: "text-green-600" },
                    { label: "작성된 글", value: dashboardKpi?.today_posts ?? 0, icon: FileText, color: "bg-purple-100", iconColor: "text-purple-600" },
                    { label: "댓글", value: dashboardKpi?.today_comments ?? 0, icon: MessageSquare, color: "bg-orange-100", iconColor: "text-orange-600" },
                  ].map(({ label, value, icon: Icon, color, iconColor }) => (
                    <div key={label} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center`}>
                          <Icon className={`w-6 h-6 ${iconColor}`} />
                        </div>
                        <span className="text-sm font-medium text-gray-600">{label}</span>
                      </div>
                      <div className="text-3xl font-bold text-gray-900">{value}</div>
                    </div>
                  ))
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-4">페이지 방문수</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={pageVisitors.map((v) => ({ name: v.section_label, visits: v.count }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip />
                      <Bar dataKey="visits" fill="#2563EB" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-4">지식 전달 점수</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={knowledgeScores.map((k) => ({ grade: k.grade_label, score: k.total_score }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="grade" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip />
                      <Bar dataKey="score" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {/* ── 운영 로그 ── */}
          {currentView === "operational" && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">운영 로그</h1>
                <p className="text-gray-600">시스템 활동 및 서비스 상태 모니터링</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="이벤트, 페이지, 상세내용 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                    />
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="pl-10 pr-8 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] appearance-none bg-white cursor-pointer"
                    >
                      <option value="all">전체 이벤트</option>
                      <option value="login">로그인</option>
                      <option value="signup">회원가입</option>
                      <option value="post">게시글</option>
                      <option value="comment">댓글</option>
                      <option value="search">검색</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {["시간", "이벤트", "페이지", "사용자 유형", "학년", "상세"].map((h) => (
                          <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loadingOperationalLogs ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center">
                            <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto" />
                          </td>
                        </tr>
                      ) : (
                        operationalLogs.map((log) => (
                          <tr
                            key={log.id}
                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => setSelectedOperationalLog(log)}
                          >
                            <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                              {log.created_at ? new Date(log.created_at).toLocaleString("ko-KR") : "-"}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-medium ${getEventTypeColor(log.event_type)}`}>
                                {log.event_type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 font-mono">{log.page || log.section || "-"}</td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {log.user_type === "graduate" ? "졸업생" : log.user_type ? "재학생" : "-"}
                            </td>
                            <td className="px-6 py-4">
                              {log.grade_at_event != null ? (
                                <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${getGradeBadgeColor(gradeToLabel(log.grade_at_event))}`}>
                                  {gradeToLabel(log.grade_at_event)}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">{log.details}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {!loadingOperationalLogs && operationalLogs.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">검색 결과가 없습니다.</p>
                  </div>
                )}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    총 <span className="font-semibold text-[#2563EB]">{operationalLogsCount}</span>개의 로그
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={operationalLogsPage <= 1}
                      onClick={() => setOperationalLogsPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-50 hover:bg-gray-50"
                    >
                      이전
                    </button>
                    <span className="text-sm text-gray-600">
                      {operationalLogsPage} / {Math.max(1, Math.ceil(operationalLogsCount / operationalLogsPageSize))}
                    </span>
                    <button
                      type="button"
                      disabled={operationalLogsPage >= Math.ceil(operationalLogsCount / operationalLogsPageSize)}
                      onClick={() => setOperationalLogsPage((p) => p + 1)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-50 hover:bg-gray-50"
                    >
                      다음
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── 행동 분석 ── */}
          {currentView === "analytics" && (
            <>
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">행동 분석: 학년 간 연결성</h1>
                  <p className="text-gray-600">학년 간 상호작용 및 지식 전달 패턴</p>
                </div>
              </div>
              {loadingAnalytics ? (
                <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <>
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6">
                    <h3 className="font-semibold text-gray-900 mb-2">학년 간 상호작용 히트맵</h3>
                    <p className="text-sm text-gray-600 mb-6">세로축: 콘텐츠 제작자 학년 / 가로축: 조회자 학년</p>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <th className="p-3 text-left text-sm font-semibold text-gray-700 border-b border-gray-200" />
                            {heatmapRows[0]?.cols.map((c) => (
                              <th key={c.viewer_grade} className="p-3 text-center text-sm font-semibold text-gray-700 border-b border-gray-200">{c.viewer_grade_label}</th>
                            )) ?? null}
                          </tr>
                        </thead>
                        <tbody>
                          {heatmapRows.map((row, i) => (
                            <tr key={i}>
                              <td className="p-3 text-sm font-semibold text-gray-700 border-r border-gray-200">{row.author_grade_label}</td>
                              {row.cols.map((col) => (
                                <td key={col.viewer_grade} className="p-3 text-center">
                                  <div
                                    className="inline-flex items-center justify-center w-16 h-16 rounded-xl font-bold text-white"
                                    style={{ backgroundColor: `rgba(37, 99, 235, ${Math.min(1, col.score / 250)})` }}
                                  >
                                    {col.score}
                                  </div>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6">
                    <h3 className="font-semibold text-gray-900 mb-4">학년별 지식 전달 점수</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={knowledgeScores.map((s) => ({ grade: s.grade_label, score: s.total_score }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="grade" stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip />
                        <Bar dataKey="score" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-4">페이지별 방문자 수</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={pageVisitors.map((v) => ({ name: v.section_label, visits: v.count }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip />
                        <Bar dataKey="visits" fill="#2563EB" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── 에러 모니터링 ── */}
          {currentView === "errors" && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">에러 모니터링</h1>
                <p className="text-gray-600">백엔드 API 에러 추적 및 모니터링</p>
              </div>
              {loadingErrors ? (
                <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                          <AlertTriangle className="w-6 h-6 text-red-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-600">오늘 에러</span>
                      </div>
                      <div className="text-3xl font-bold text-gray-900">{errorStats?.today_count ?? 0}</div>
                    </div>
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                          <TrendingUp className="w-6 h-6 text-purple-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-600">총 요청수 (오늘)</span>
                      </div>
                      <div className="text-3xl font-bold text-gray-900">{(errorStats?.total_requests ?? 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                          <Clock className="w-6 h-6 text-blue-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-600">평균 응답시간</span>
                      </div>
                      <div className="text-3xl font-bold text-gray-900">
                        {errorStats?.avg_response_time_ms != null
                          ? `${errorStats.avg_response_time_ms}ms`
                          : "-"}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">오늘 에러 응답 기준</p>
                    </div>
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                          <AlertCircle className="w-6 h-6 text-orange-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-600">에러율</span>
                      </div>
                      <div className="text-3xl font-bold text-gray-900">
                        {errorStats?.total_requests
                          ? `${((errorStats.today_count / errorStats.total_requests) * 100).toFixed(1)}%`
                          : "-"}
                      </div>
                    </div>
                  </div>
                  {errorStats && (
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6">
                      <h3 className="font-semibold text-gray-900 mb-4">에러 발생 추이 (오늘 시간대별)</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={errorStats.trend.map((t) => ({ time: `${t.hour}시`, errors: t.count }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="time" stroke="#9ca3af" />
                          <YAxis stroke="#9ca3af" />
                          <Tooltip />
                          <Line type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 mb-6">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="엔드포인트, 에러 메시지 검색..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                        />
                      </div>
                      <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <select
                          value={errorSeverityFilter}
                          onChange={(e) => setErrorSeverityFilter(e.target.value)}
                          className="pl-10 pr-8 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] appearance-none bg-white cursor-pointer"
                        >
                          <option value="all">전체</option>
                          <option value="low">4xx</option>
                          <option value="high">5xx</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">시간</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">엔드포인트</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">메소드</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">상태 코드</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">에러 메시지</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredErrors.map((error) => {
                            const severity = error.status_code >= 500 ? "high" : error.status_code >= 400 ? "medium" : "low";
                            return (
                              <tr key={error.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{error.created_at ? new Date(error.created_at).toLocaleString("ko-KR") : "-"}</td>
                                <td className="px-6 py-4 text-sm font-mono text-gray-900">{error.path}</td>
                                <td className="px-6 py-4">
                                  <span className="inline-flex px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700">{error.method}</span>
                                </td>
                                <td className="px-6 py-4 text-sm font-mono text-gray-900">{error.status_code}</td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-medium ${getSeverityColor(severity)}`}>
                                    {error.status_code}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">{error.message}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {filteredErrors.length === 0 && (
                      <div className="text-center py-12 text-gray-500">검색 결과가 없습니다.</div>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── 이벤트 설정 ── */}
          {currentView === "eventConfig" && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">이벤트 설정</h1>
                <p className="text-gray-600">이벤트 추적 ON/OFF 관리</p>
              </div>
              {loadingEvents ? (
                <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    {["navigation", "authentication", "content", "engagement", "discovery"].map((cat) => (
                      <div key={cat} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                        <div className="text-sm font-medium text-gray-600 mb-2">{eventCategoryToLabel(cat)}</div>
                        <div className="text-3xl font-bold text-gray-900">
                          {eventSettings.filter((e) => e.category === cat).length}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">이벤트명</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">카테고리</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">발생 횟수</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">상태</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {eventSettings.map((s) => (
                            <tr key={s.event_type} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 text-sm font-mono font-medium text-gray-900">{s.event_type}</td>
                              <td className="px-6 py-4">
                                <span className="inline-flex px-3 py-1 rounded-lg text-xs font-medium bg-blue-100 text-blue-700">{eventCategoryToLabel(s.category)}</span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900">{s.log_count.toLocaleString()}</td>
                              <td className="px-6 py-4">
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={s.is_active}
                                    onChange={() => handleEventToggle(s.event_type, !s.is_active)}
                                    className="sr-only peer"
                                  />
                                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                                </label>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── 유저 관리 ── */}
          {currentView === "userManagement" && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">유저 관리</h1>
                <p className="text-gray-600">사용자 활동 현황 및 관리</p>
              </div>
              {/* KPI 카드 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "전체 사용자", value: usersList.length, icon: Users, color: "bg-blue-100", iconColor: "text-blue-600" },
                  { label: "총 게시글", value: usersList.reduce((s, u) => s + u.post_count, 0), icon: FileText, color: "bg-purple-100", iconColor: "text-purple-600" },
                  { label: "총 댓글", value: usersList.reduce((s, u) => s + u.comment_count, 0), icon: MessageSquare, color: "bg-orange-100", iconColor: "text-orange-600" },
                  { label: "활성 사용자", value: usersList.length, icon: Activity, color: "bg-green-100", iconColor: "text-green-600" },
                ].map(({ label, value, icon: Icon, color, iconColor }) => (
                  <div key={label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-9 h-9 ${color} rounded-xl flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${iconColor}`} />
                      </div>
                      <span className="text-xs font-medium text-gray-600">{label}</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{value}</div>
                  </div>
                ))}
              </div>
              {loadingUsers ? (
                <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">사용자 목록</h3>
                      <p className="text-sm text-gray-600 mt-1">닉네임, 학년, 관심분야별 활동 현황</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setNotificationModalOpen(true); setNotificationError(""); setNotificationContent(""); }}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors"
                      >
                        <Bell className="w-4 h-4" />
                        알림 일괄 발송
                      </button>
                      <button
                        type="button"
                        onClick={() => { setBroadcastModalOpen(true); setBroadcastError(""); setBroadcastContent(""); }}
                        className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-xl text-sm font-medium hover:bg-[#1d4ed8] transition-colors"
                      >
                        <Mail className="w-4 h-4" />
                        전체 쪽지 보내기
                      </button>
                    </div>
                  </div>
                  {/* 필터: 박스 안, 가로 스크롤 */}
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex gap-6 overflow-x-auto pb-1">
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">학년</span>
                        <div className="flex gap-1.5">
                          {["all", "1학년", "2학년", "3학년", "4학년"].map((g) => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => setGradeFilter(g)}
                              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
                                gradeFilter === g
                                  ? "bg-[#2563EB] text-white font-medium"
                                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              {g === "all" ? "전체" : g}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">관심분야</span>
                        <div className="flex gap-1.5">
                          {["all", "AI", "데이터", "경영"].map((i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setInterestFilter(i)}
                              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
                                interestFilter === i
                                  ? "bg-[#8B5CF6] text-white font-medium"
                                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              {i === "all" ? "전체" : i}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {["닉네임", "학년", "관심분야", "게시글", "댓글"].map((h) => (
                            <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {usersList.map((u) => (
                          <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{u.nickname}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-medium ${getGradeBadgeColor(gradeToLabel(u.grade))}`}>
                                {gradeToLabel(u.grade)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-medium ${getInterestBadgeColor(u.interests?.[0] ? interestToLabel(u.interests[0]) : "-")}`}>
                                {u.interests?.[0] ? interestToLabel(u.interests[0]) : "-"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">{u.post_count}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{u.comment_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {usersList.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-gray-500">검색 결과가 없습니다.</p>
                    </div>
                  )}
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      총 <span className="font-semibold text-[#2563EB]">{usersList.length}</span>명의 사용자
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── 검색 분석 ── */}
          {currentView === "searchAnalytics" && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">검색 분석: 인기 키워드</h1>
                <p className="text-gray-600">학생들이 가장 관심을 두는 키워드 분석</p>
              </div>
              {loadingSearch ? (
                <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-semibold text-gray-900">인기 검색어 순위</h3>
                    <p className="text-sm text-gray-600 mt-1">검색 빈도와 주요 검색자 학년 정보</p>
                  </div>
                  {/* 총 검색 횟수 + 관심분야 필터 (박스 안, 가로 스크롤) */}
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex flex-wrap items-center gap-4 overflow-x-auto pb-1">
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center">
                          <Search className="w-5 h-5 text-pink-600" />
                        </div>
                        <div>
                          <span className="text-xs font-medium text-gray-500 block">총 검색 횟수</span>
                          <span className="text-xl font-bold text-gray-900">{searchTotal.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="h-8 w-px bg-gray-200 flex-shrink-0 hidden sm:block" />
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">관심분야</span>
                        <div className="flex gap-1.5">
                          {["all", "AI", "데이터", "경영"].map((i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setSearchInterestFilter(i)}
                              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
                                searchInterestFilter === i
                                  ? "bg-[#8B5CF6] text-white font-medium"
                                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              {i === "all" ? "전체" : i}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            {["순위", "키워드", "검색 빈도", "주요 검색자 학년", "관심분야"].map((h) => (
                              <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {searchRanking.map((item, index) => (
                            <tr key={item.keyword} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold ${
                                  index === 0 ? "bg-yellow-500" : index === 1 ? "bg-gray-400" : index === 2 ? "bg-orange-600" : "bg-gray-300"
                                }`}>
                                  {item.rank}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.keyword}</td>
                              <td className="px-6 py-4 text-sm font-bold text-gray-900">{item.count.toLocaleString()}회</td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-medium ${getGradeBadgeColor(item.main_grade_label)}`}>
                                  {item.main_grade_label}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-medium ${getInterestBadgeColor(item.main_interest_label)}`}>
                                  {item.main_interest_label}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {searchRanking.length === 0 && (
                      <div className="text-center py-12 text-gray-500">데이터가 없습니다.</div>
                    )}
                </div>
              )}
            </>
          )}

          {/* ── 세션 분석 ── */}
          {currentView === "sessions" && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">세션 분석</h1>
                <p className="text-gray-600">평균 세션·체류시간, 학년별 평균 세션 시간, 세션 시간 분포 (최근 30일)</p>
              </div>
              {/* KPI 카드 */}
              {loadingSession ? (
                <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Clock className="w-6 h-6 text-blue-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-600">평균 세션</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-900">{sessionStats?.average_session_display ?? "0:00"}</div>
                  </div>
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                        <Activity className="w-6 h-6 text-green-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-600">평균 체류시간</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-900">{sessionStats?.average_session_display ?? "0:00"}</div>
                  </div>
                </div>
              )}
              {/* 학년별 평균 세션 시간 (분) */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">평균 세션 시간 (분)</h3>
                <p className="text-sm text-gray-600 mb-6">학년/유형별 평균 체류 시간</p>
                {loadingSessionAnalytics ? (
                  <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>
                ) : sessionByGrade.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">데이터가 없습니다.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={sessionByGrade.map((g) => ({ name: g.grade_label, 분: g.average_minutes }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" label={{ value: "분", position: "insideTopLeft" }} />
                      <Tooltip formatter={(v: unknown) => [typeof v === "number" && Number.isFinite(v) ? `${v}분` : "-", "평균"]} />
                      <Bar dataKey="분" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              {/* 세션 시간 분포 */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-8">
                <h3 className="font-semibold text-gray-900 mb-4">세션 시간 분포</h3>
                <p className="text-sm text-gray-600 mb-6">체류 시간 구간별 세션 수</p>
                {loadingSessionAnalytics ? (
                  <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>
                ) : sessionDistribution.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">데이터가 없습니다.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={sessionDistribution.map((d) => ({ name: d.bucket, 세션수: d.count }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip />
                      <Bar dataKey="세션수" fill="#2563EB" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </>
          )}

          {/* 공지/배너 섹션은 현재 사용하지 않음 */}

        </div>
      </main>

      {/* 이벤트 상세 패널 (목데이터용) */}
      {selectedLog && (
        <EventDetailPanel log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
      {/* 운영 로그(API) 상세 패널 */}
      {selectedOperationalLog && (
        <OperationalLogDetailPanel log={selectedOperationalLog} onClose={() => setSelectedOperationalLog(null)} />
      )}

      {/* 전체 쪽지 보내기 모달 */}
      {broadcastModalOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg text-gray-900">전체 쪽지 보내기</h3>
              <button
                type="button"
                onClick={() => !broadcastSending && setBroadcastModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <textarea
              value={broadcastContent}
              onChange={(e) => setBroadcastContent(e.target.value)}
              placeholder="쪽지 내용을 입력하세요."
              rows={5}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent resize-none"
            />
            <label className="mt-3 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={broadcastToCurrentList}
                onChange={(e) => setBroadcastToCurrentList(e.target.checked)}
                className="rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB]"
              />
              <span className="text-sm text-gray-700">현재 목록에만 보내기 ({usersList.length}명)</span>
            </label>
            {broadcastError && (
              <p className="mt-2 text-sm text-red-500">{broadcastError}</p>
            )}
            <div className="mt-6 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => !broadcastSending && setBroadcastModalOpen(false)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleBroadcastSubmit}
                disabled={broadcastSending}
                className="px-4 py-2 bg-[#2563EB] text-white rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50"
              >
                {broadcastSending ? "보내는 중..." : "보내기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 알림 일괄 발송 모달 */}
      {notificationModalOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg text-gray-900">알림 일괄 발송</h3>
              <button
                type="button"
                onClick={() => !notificationSending && setNotificationModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">모든 사용자의 알림 함에 공지가 전달됩니다.</p>
            <textarea
              value={notificationContent}
              onChange={(e) => setNotificationContent(e.target.value)}
              placeholder="알림 메시지를 입력하세요."
              rows={5}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
            />
            <label className="mt-3 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={notificationToCurrentList}
                onChange={(e) => setNotificationToCurrentList(e.target.checked)}
                className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-sm text-gray-700">현재 목록에만 보내기 ({usersList.length}명)</span>
            </label>
            {notificationError && (
              <p className="mt-2 text-sm text-red-500">{notificationError}</p>
            )}
            <div className="mt-6 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => !notificationSending && setNotificationModalOpen(false)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleNotificationBroadcast}
                disabled={notificationSending}
                className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
              >
                {notificationSending ? "보내는 중..." : "알림 보내기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 공지/배너 추가·수정 모달 */}
      {noticeModalOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg text-gray-900">
                {noticeEditing ? "공지/배너 수정" : "공지/배너 추가"}
              </h3>
              <button
                type="button"
                onClick={closeNoticeModal}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
                <input
                  value={noticeForm.title}
                  onChange={(e) => setNoticeForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  placeholder="제목"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                <textarea
                  value={noticeForm.content}
                  onChange={(e) => setNoticeForm((f) => ({ ...f, content: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none"
                  placeholder="내용"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">링크 URL</label>
                <input
                  value={noticeForm.link}
                  onChange={(e) => setNoticeForm((f) => ({ ...f, link: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이미지 URL</label>
                <input
                  value={noticeForm.image_url}
                  onChange={(e) => setNoticeForm((f) => ({ ...f, image_url: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">유형</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="notice_type"
                      checked={noticeForm.notice_type === "notice"}
                      onChange={() => setNoticeForm((f) => ({ ...f, notice_type: "notice" }))}
                      className="text-[#2563EB] focus:ring-[#2563EB]"
                    />
                    <span className="text-sm">공지</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="notice_type"
                      checked={noticeForm.notice_type === "banner"}
                      onChange={() => setNoticeForm((f) => ({ ...f, notice_type: "banner" }))}
                      className="text-[#2563EB] focus:ring-[#2563EB]"
                    />
                    <span className="text-sm">배너</span>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">노출 시작일</label>
                  <input
                    type="datetime-local"
                    value={noticeForm.starts_at ? noticeForm.starts_at.slice(0, 16) : ""}
                    onChange={(e) => setNoticeForm((f) => ({ ...f, starts_at: e.target.value || undefined }))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">노출 종료일</label>
                  <input
                    type="datetime-local"
                    value={noticeForm.ends_at ? noticeForm.ends_at.slice(0, 16) : ""}
                    onChange={(e) => setNoticeForm((f) => ({ ...f, ends_at: e.target.value || undefined }))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noticeForm.is_active}
                    onChange={(e) => setNoticeForm((f) => ({ ...f, is_active: e.target.checked }))}
                    className="rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB]"
                  />
                  <span className="text-sm font-medium text-gray-700">활성</span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">순서</label>
                  <input
                    type="number"
                    min={0}
                    value={noticeForm.order ?? 0}
                    onChange={(e) => setNoticeForm((f) => ({ ...f, order: parseInt(e.target.value, 10) || 0 }))}
                    className="w-20 px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
              </div>
            </div>
            {noticeError && <p className="mt-3 text-sm text-red-500">{noticeError}</p>}
            <div className="mt-6 flex gap-2 justify-end">
              <button
                type="button"
                onClick={closeNoticeModal}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleNoticeSave}
                disabled={noticeSaving}
                className="px-4 py-2 bg-[#2563EB] text-white rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50"
              >
                {noticeSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
