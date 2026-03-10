"use client";

import { useEffect, useState } from "react";

function clearAuth() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user_id");
}

function getTokenExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * 인증 필요 페이지에서 사용. 토큰 없으면 로그인으로 즉시 리다이렉트.
 * 토큰 만료 시각을 파싱해 남은 시간 후 자동 로그아웃 처리.
 * isReady가 false일 때는 콘텐츠를 렌더하지 않아 페이지 플래시를 방지.
 */
export function useRequireAuth(): { isReady: boolean } {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      window.location.replace("/login");
      return;
    }

    const exp = getTokenExp(token);
    const now = Date.now();

    if (exp === null || exp <= now) {
      clearAuth();
      window.location.replace("/login");
      return;
    }

    setIsReady(true);

    const remaining = exp - now;
    const timer = setTimeout(() => {
      clearAuth();
      window.location.replace("/login");
    }, remaining);

    return () => clearTimeout(timer);
  }, []);

  return { isReady };
}
