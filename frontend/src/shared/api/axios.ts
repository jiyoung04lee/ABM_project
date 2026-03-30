import axios from "axios";
import { API_BASE } from "./api";

const api = axios.create({
  baseURL: `${API_BASE}/api/`,
  withCredentials: true, // 모든 요청에 쿠키 자동 첨부
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (error.config?.url?.includes("users/me/")) {
        return Promise.reject(error);
      }
      // user_id만 정리 (access/refresh는 쿠키라 서버에서 삭제)
      localStorage.removeItem("user_id");
      window.location.replace("/login");
    }
    return Promise.reject(error);
  }
);

export default api;