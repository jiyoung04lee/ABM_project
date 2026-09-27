"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getPageViewSection, sendPageView } from "@/shared/api/logs";
import {
  captureTouch,
  getOrCreateSessionId,
  getSessionTouch,
} from "@/shared/utils/tracking";

/**
 * 메인 섹션(홈/커뮤니티/네트워크/학과정보) 방문 시 page_view 이벤트 전송.
 * session_id를 함께 보내서 백엔드에서 평균 세션·체류시간 집계가 가능해짐.
 * 모든 페이지에서 유입 정보(utm·referrer)를 먼저 기록해, 가입·로그인 시 함께 보낸다.
 */
export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    captureTouch();
    const section = getPageViewSection(pathname);
    if (!section) return;
    const sessionId = getOrCreateSessionId();
    sendPageView(section, pathname, sessionId, getSessionTouch()).catch(() => {});
  }, [pathname]);

  return null;
}
