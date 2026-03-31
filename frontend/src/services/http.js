import axios from "axios";

const baseURL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api")
  .trim()
  .replace(/\/+$/, "");

const http = axios.create({
  baseURL,
  withCredentials: false,
});

// ✅ Request interceptor: token + content-type seguro
http.interceptors.request.use(
  (config) => {
    // Token (ajusta si tu key es otra)
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("access_token") ||
      null;

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    // ✅ Importante: NO forzar JSON cuando es FormData
    const isFormData =
      typeof FormData !== "undefined" && config.data instanceof FormData;

    config.headers = config.headers || {};

    if (isFormData) {
      // Deja que axios/browser ponga multipart con boundary
      if (config.headers["Content-Type"]) delete config.headers["Content-Type"];
      if (config.headers["content-type"]) delete config.headers["content-type"];
    } else {
      // Para JSON normal
      if (!config.headers["Content-Type"] && !config.headers["content-type"]) {
        config.headers["Content-Type"] = "application/json";
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default http;
