import axios from "axios";
import { API_BASE } from "./api";

const api = axios.create({
  baseURL: `${API_BASE}/api/`,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // users/me/는 각 컴포넌트에서 직접 처리하므로 여기서 redirect 안 함
    if (error.response?.status === 401) {
      localStorage.removeItem("user_id");
      // useRequireAuth나 각 페이지에서 처리하도록 그냥 reject만
    }
    return Promise.reject(error);
  }
);

export default api;