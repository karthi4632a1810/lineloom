import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";

/** Avoid multiple redirects when several requests fail with 401 at once */
let authRedirectScheduled = false;

export const resetAuthRedirectFlag = () => {
  authRedirectScheduled = false;
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token") ?? "";
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = String(error?.config?.url ?? "");
    const isAuthRoute =
      requestUrl.includes("/auth/login") || requestUrl.includes("/auth/register");

    if (
      status === 401 &&
      !isAuthRoute &&
      typeof window !== "undefined" &&
      !authRedirectScheduled
    ) {
      authRedirectScheduled = true;
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_role");
      const next = `${window.location.pathname}${window.location.search}`;
      const redirect = `/login?expired=1&next=${encodeURIComponent(next)}`;
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign(redirect);
      }
    }

    const dataMessage = error?.response?.data?.message;
    let userMessage = dataMessage;

    if (!error.response) {
      if (error?.code === "ECONNABORTED") {
        userMessage = `Request timed out after ${apiClient.defaults.timeout ?? 10000} ms. Try again or check the API server.`;
      } else {
        userMessage = `Cannot reach the API at ${API_BASE_URL}. Start the backend (e.g. npm run dev in /backend) and confirm VITE_API_BASE_URL if you use a custom URL.`;
      }
    } else if (!userMessage) {
      userMessage = "We could not complete your request. Please try again.";
    }

    return Promise.reject(new Error(userMessage));
  }
);
