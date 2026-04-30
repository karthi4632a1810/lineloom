import { apiClient } from "./apiClient";

export const fetchDashboardSummary = async (params = {}) => {
  const { data } = await apiClient.get("/dashboard/summary", { params });
  return data?.data ?? null;
};

export const fetchDashboardTokens = async (params = {}) => {
  const { data } = await apiClient.get("/dashboard/tokens", { params });
  return data?.data ?? [];
};

export const fetchHisDepartments = async () => {
  const { data } = await apiClient.get("/his/departments");
  return data?.data ?? [];
};
