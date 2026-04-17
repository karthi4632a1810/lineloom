import { apiClient } from "./apiClient";

export const fetchTokenJourney = async (tokenId = "") => {
  const { data } = await apiClient.get(`/tokens/${encodeURIComponent(tokenId)}/journey`);
  return data?.data ?? null;
};

export const fetchDepartmentFunnel = async (params = {}) => {
  const { data } = await apiClient.get("/journey/department-funnel", { params });
  return data?.data ?? null;
};
