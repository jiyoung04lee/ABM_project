export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/** DEBUG 백엔드가 내려준 signup_token 임시 보관(로컬 크로스오리진 시 쿠키 대체) */
export const ONBOARDING_SIGNUP_STORAGE_KEY = "onboarding_signup_token";

/** 더블 서브밋 CSRF 방어 — 백엔드가 내려준 nonce 보관 */
export const ONBOARDING_NONCE_STORAGE_KEY = "onboarding_nonce";

// ── JWT 토큰 헬퍼 ──────────────────────────────────────────
export const TokenStorage = {
  getAccess: () => localStorage.getItem("access_token"),
  getRefresh: () => localStorage.getItem("refresh_token"),
  set: (access: string, refresh: string) => {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
  },
  clear: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_id");
  },
};

// ── 인증 헤더 포함 fetch 래퍼 ──────────────────────────────
export async function apiFetch(
  input: RequestInfo,
  init: RequestInit = {}
): Promise<Response> {
  const token = TokenStorage.getAccess();
  return fetch(input, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}