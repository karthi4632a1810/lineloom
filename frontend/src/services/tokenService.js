import { apiClient } from "./apiClient";

export const createTokenRequest = async (payload = {}) => {
  const { data } = await apiClient.post("/tokens", payload);
  return data?.data ?? null;
};

export const fetchLiveQueue = async (params = {}) => {
  const { data } = await apiClient.get("/tokens/queue/live", { params });
  return data?.data ?? [];
};

export const fetchCompletedQueue = async (params = {}) => {
  const { data } = await apiClient.get("/tokens/queue/completed", { params });
  return data?.data ?? [];
};

export const fetchTokenDetail = async (tokenId = "") => {
  const { data } = await apiClient.get(`/tokens/${tokenId}`);
  return data?.data ?? null;
};

export const startWaitingRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenId}/start-waiting`);

export const stepBackRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenId}/step-back`);

export const revertTokenRequest = async (tokenId = "", anchor = "") =>
  apiClient.post(`/tokens/${tokenId}/revert`, { anchor: String(anchor ?? "").trim() });
export const startConsultRequest = async (tokenId = "", payload = {}) =>
  apiClient.post(`/tokens/${tokenId}/start-consult`, payload);
export const endConsultRequest = async (tokenId = "", payload = {}) =>
  apiClient.post(`/tokens/${tokenId}/end-consult`, payload);
export const orderLabsRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenId}/order-labs`);
export const startBillingRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenId}/start-billing`);
export const stopBillingRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenId}/stop-billing`);
export const endBillingRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenId}/end-billing`);
export const startPharmacyRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenId}/start-pharmacy`);
export const stopPharmacyRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenId}/stop-pharmacy`);
export const endPharmacyRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenId}/end-pharmacy`);
export const recordBillingPaymentRequest = async (tokenId = "", payload = {}) =>
  apiClient.post(`/tokens/${tokenId}/record-billing-payment`, payload);
export const updateBillingPaymentRequest = async (tokenId = "", paymentId = "", payload = {}) =>
  apiClient.patch(`/tokens/${tokenId}/billing-payments/${paymentId}`, payload);
export const deleteBillingPaymentRequest = async (tokenId = "", paymentId = "") =>
  apiClient.delete(`/tokens/${tokenId}/billing-payments/${paymentId}`);
export const startLabRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenId}/start-lab`);
export const endLabRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenId}/end-lab`);
export const startCareRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenId}/start-treatment`);
export const endCareRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenId}/end-treatment`);
export const completeVisitAfterConsultRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenId}/complete-visit`);
export const branchTokenRequest = async (tokenId = "", payload = {}) =>
  apiClient.post(`/tokens/${tokenId}/branch`, payload);
