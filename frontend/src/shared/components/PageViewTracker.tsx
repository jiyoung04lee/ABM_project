"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getPageViewSection, sendPageView } from "@/shared/api/logs";

const SESSION_ID_KEY = "aive_session_id";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

/**
 * 메인 섹션(홈/커뮤니티/네트워크/학과정보) 방문 시 page_view 이벤트 전송.
 * session_id를 함께 보내서 백엔드에서 평균 세션·체류시간 집계가 가능해짐.
 */
export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const section = getPageViewSection(pathname);
    if (!section) return;
    const sessionId = getOrCreateSessionId();
    sendPageView(section, pathname, sessionId).catch(() => {});
  }, [pathname]);

  return null;
}
