export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export const ONBOARDING_SIGNUP_STORAGE_KEY = "onboarding_signup_token";
export const ONBOARDING_NONCE_STORAGE_KEY = "onboarding_nonce";

// JWT is carried by HttpOnly cookies. This wrapper only clears old tokens left
// by previous builds.
export const TokenStorage = {
  getAccess: () => null,
  getRefresh: () => null,
  set: (_access?: string, _refresh?: string) => {},
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
