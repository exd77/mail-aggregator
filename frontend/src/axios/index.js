import axios from "axios";
import router from "@/router";
import { ElMessage } from "element-plus";
import i18n from "@/i18n";

const http = axios.create({ baseURL: "/api" });

const t = (key) => i18n.global.t(key);

// cloud-mail pattern: inject raw token in Authorization header
http.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = token;
  return config;
});

http.interceptors.response.use(
  (res) => {
    const data = res.data;
    if (data.code === 200) return data.data;
    if (data.code === 401) {
      localStorage.removeItem("token");
      router.replace("/login");
    }
    ElMessage.error(data.message || t("toast.requestFailed"));
    return Promise.reject(data);
  },
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      localStorage.removeItem("token");
      router.replace("/login");
    }
    ElMessage.error(error.response?.data?.message || error.message || t("toast.networkError"));
    return Promise.reject(error);
  }
);

export default http;
