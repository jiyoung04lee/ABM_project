"use client";

import { useEffect, useState } from "react";

/**
 * 인증 필요 페이지에서 사용. 토큰 없으면 로그인으로 즉시 리다이렉트.
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
    setIsReady(true);
  }, []);

  return { isReady };
}
