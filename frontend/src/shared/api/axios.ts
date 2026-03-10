import axios from "axios";
import { API_BASE } from "./api";

const api = axios.create({
  baseURL: `${API_BASE}/api/`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user_id");
      window.location.replace("/login");
    }
    return Promise.reject(error);
  }
);

export default api;
