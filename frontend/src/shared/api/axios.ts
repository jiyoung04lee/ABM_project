import axios from "axios";
import { API_BASE } from "./api";

const api = axios.create({
  baseURL: `${API_BASE}/api/`,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.replace("/login");
    }
    return Promise.reject(error);
  }
);

export default api;
