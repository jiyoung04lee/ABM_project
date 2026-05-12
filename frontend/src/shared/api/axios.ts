import axios from "axios";
import { API_BASE, TokenStorage } from "./api";

const api = axios.create({
  baseURL: `${API_BASE}/api/`,
  withCredentials: true,
});

// 요청마다 Authorization 헤더 자동 주입
api.interceptors.request.use((config) => {
  const token = TokenStorage.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      TokenStorage.clear(); // user_id 포함 전부 삭제
    }
    return Promise.reject(error);
  }
);

export default api;