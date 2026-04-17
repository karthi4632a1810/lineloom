import { apiClient } from "./apiClient";

export const fetchIntelligenceSummary = async () => {
  const { data } = await apiClient.get("/intelligence/summary");
  return data?.data ?? null;
};

export const recordOperationalActionRequest = async (payload = {}) => {
  const { data } = await apiClient.post("/intelligence/actions", payload);
  return data?.data ?? null;
};

export const refreshModelVersionRequest = async () => {
  const { data } = await apiClient.post("/intelligence/model-refresh");
  return data?.data ?? null;
};
