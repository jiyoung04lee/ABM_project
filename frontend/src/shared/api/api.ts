export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/** DEBUG 백엔드가 내려준 signup_token 임시 보관(로컬 크로스오리진 시 쿠키 대체) */
export const ONBOARDING_SIGNUP_STORAGE_KEY = "onboarding_signup_token";

/** 더블 서브밋 CSRF 방어 — 백엔드가 내려준 nonce 보관 */
export const ONBOARDING_NONCE_STORAGE_KEY = "onboarding_nonce";