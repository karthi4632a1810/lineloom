import { apiClient } from "./apiClient";

export const createTokenRequest = async (payload = {}) => {
  const { data } = await apiClient.post("/tokens", payload);
  return data?.data ?? null;
};

export const fetchLiveQueue = async () => {
  const { data } = await apiClient.get("/tokens/queue/live");
  return data?.data ?? [];
};

export const fetchTokenDetail = async (tokenId = "") => {
  const { data } = await apiClient.get(`/tokens/${tokenId}`);
  return data?.data ?? null;
};

export const startWaitingRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenId}/start-waiting`);
export const startConsultRequest = async (tokenId = "", payload = {}) =>
  apiClient.post(`/tokens/${tokenId}/start-consult`, payload);
export const endConsultRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenId}/end-consult`);
export const startCareRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenId}/start-treatment`);
export const endCareRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenId}/end-treatment`);
export const branchTokenRequest = async (tokenId = "", payload = {}) =>
  apiClient.post(`/tokens/${tokenId}/branch`, payload);
