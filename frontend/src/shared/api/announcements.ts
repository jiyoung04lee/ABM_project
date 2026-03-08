import api from "./axios";

export interface SiteNoticeItem {
  id: number;
  title: string;
  content: string;
  link: string;
  image_url: string;
  notice_type: "banner" | "notice";
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface SiteNoticePayload {
  title: string;
  content?: string;
  link?: string;
  image_url?: string;
  notice_type?: "banner" | "notice";
  starts_at?: string | null;
  ends_at?: string | null;
  is_active?: boolean;
  order?: number;
}

/** 활성 공지/배너 목록 (비인증 가능, 기간·활성 필터 적용) */
export const getSiteNotices = () =>
  api.get<SiteNoticeItem[]>("announcements/");

/** 관리자: 전체 목록 */
export const getSiteNoticesAdmin = () =>
  api.get<SiteNoticeItem[] | { results: SiteNoticeItem[] }>("announcements/");

/** 관리자: 생성 */
export const createSiteNotice = (payload: SiteNoticePayload) =>
  api.post<SiteNoticeItem>("announcements/", payload);

/** 관리자: 수정 */
export const updateSiteNotice = (id: number, payload: Partial<SiteNoticePayload>) =>
  api.patch<SiteNoticeItem>(`announcements/${id}/`, payload);

/** 관리자: 삭제 */
export const deleteSiteNotice = (id: number) =>
  api.delete(`announcements/${id}/`);
