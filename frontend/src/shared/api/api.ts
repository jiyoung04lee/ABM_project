// Keep browser requests on the frontend origin. Next.js proxies this path to
// Django so Safari does not treat authentication cookies as third-party.
export const API_BASE = "/backend-api";

export const ONBOARDING_SIGNUP_STORAGE_KEY = "onboarding_signup_token";
export const ONBOARDING_NONCE_STORAGE_KEY = "onboarding_nonce";

// JWT is primarily carried by HttpOnly cookies. localStorage is kept as a
// fallback for browsers that refuse local cross-origin cookies during dev.
export const TokenStorage = {
  getAccess: () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token");
  },
  getRefresh: () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("refresh_token");
  },
  set: (access?: string, refresh?: string) => {
    if (typeof window === "undefined") return;
    if (access) localStorage.setItem("access_token", access);
    if (refresh) localStorage.setItem("refresh_token", refresh);
  },
  clear: () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_id");
  },
};

export async function apiFetch(
  input: RequestInfo,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}
