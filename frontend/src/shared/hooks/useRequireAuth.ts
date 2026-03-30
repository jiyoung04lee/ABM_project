"use client";

import { useEffect, useState } from "react";

/**
 * 인증 필요 페이지에서 사용.
 * 쿠키 방식으로 전환 후: API 호출로 인증 확인.
 * isReady가 false일 때는 콘텐츠를 렌더하지 않아 페이지 플래시를 방지.
 */
export function useRequireAuth(): { isReady: boolean } {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 쿠키 방식: API 호출로 인증 확인 (쿠키는 자동 첨부)
    fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/users/me/`, {
      credentials: "include",
    })
      .then((res) => {
        if (res.ok) {
          setIsReady(true);
        } else {
          window.location.replace("/login");
        }
      })
      .catch(() => {
        window.location.replace("/login");
      });
  }, []);

  return { isReady };
}