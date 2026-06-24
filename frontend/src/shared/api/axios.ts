import axios from "axios";
import { API_BASE, TokenStorage } from "./api";

const api = axios.create({
  baseURL: `${API_BASE}/api/`,
  withCredentials: true,
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
