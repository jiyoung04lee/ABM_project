"use client";

import { useEffect, useState } from "react";
import api from "@/shared/api/axios";

/**
 * 인증 필요 페이지에서 사용.
 * - 서버의 /users/me/ 호출이 성공하면 로그인 상태로 간주
 * - 401이면 로그인 페이지로 리다이렉트
 */
export function useRequireAuth(): { isReady: boolean } {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await api.get("users/me/");
        if (!cancelled) setIsReady(true);
      } catch {
        if (!cancelled) {
          window.location.replace("/login");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { isReady };
}
