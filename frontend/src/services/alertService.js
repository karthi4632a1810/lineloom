import { apiClient } from "./apiClient";

export const fetchAlerts = async (params = {}) => {
  const { data } = await apiClient.get("/alerts", { params });
  return data?.data ?? [];
};

export const fetchAlertRecommendations = async () => {
  const { data } = await apiClient.get("/alerts/recommendations");
  return data?.data ?? null;
};

export const acknowledgeAlertRequest = async (id = "") => {
  const { data } = await apiClient.post(`/alerts/${encodeURIComponent(id)}/acknowledge`, {});
  return data?.data ?? null;
};
