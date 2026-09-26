import axios from "axios";
import { API_BASE, TokenStorage } from "./api";
import { getOrCreateSessionId } from "@/shared/utils/tracking";

const api = axios.create({
  baseURL: `${API_BASE}/api/`,
  withCredentials: true,
});

// 모든 API 요청에 방문 단위 세션 ID를 붙여, 서버의 이벤트 로그가 같은 방문으로 이어지게 한다
api.interceptors.request.use((config) => {
  const sessionId = getOrCreateSessionId();
  if (sessionId) config.headers.set("X-Session-Id", sessionId);
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = String(error.config?.url ?? "");
      TokenStorage.clear();
      if (
        typeof window !== "undefined" &&
        !requestUrl.includes("users/me/") &&
        !window.location.pathname.startsWith("/login")
      ) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
