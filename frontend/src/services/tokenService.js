import { apiClient } from "./apiClient";
import { encodeTokenIdForPath } from "../utils/tokenPaths.js";

const tokenPath = (tokenId = "") => encodeTokenIdForPath(tokenId);

export const createTokenRequest = async (payload = {}) => {
  const { data } = await apiClient.post("/tokens", payload);
  return data?.data ?? null;
};

export const checkExistingTokenRequest = async (params = {}) => {
  const { data } = await apiClient.get("/tokens/existing", { params });
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
  const { data } = await apiClient.get(`/tokens/${tokenPath(tokenId)}`);
  return data?.data ?? null;
};

export const startWaitingRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenPath(tokenId)}/start-waiting`);

export const stepBackRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenPath(tokenId)}/step-back`);

export const revertTokenRequest = async (tokenId = "", anchor = "") =>
  apiClient.post(`/tokens/${tokenPath(tokenId)}/revert`, { anchor: String(anchor ?? "").trim() });
export const startConsultRequest = async (tokenId = "", payload = {}) =>
  apiClient.post(`/tokens/${tokenPath(tokenId)}/start-consult`, payload);
export const endConsultRequest = async (tokenId = "", payload = {}) =>
  apiClient.post(`/tokens/${tokenPath(tokenId)}/end-consult`, payload);
export const orderLabsRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenPath(tokenId)}/order-labs`);
export const startBillingRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenPath(tokenId)}/start-billing`);
export const stopBillingRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenPath(tokenId)}/stop-billing`);
export const endBillingRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenPath(tokenId)}/end-billing`);
export const startPharmacyRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenPath(tokenId)}/start-pharmacy`);
export const stopPharmacyRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenPath(tokenId)}/stop-pharmacy`);
export const endPharmacyRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenPath(tokenId)}/end-pharmacy`);
export const recordBillingPaymentRequest = async (tokenId = "", payload = {}) =>
  apiClient.post(`/tokens/${tokenPath(tokenId)}/record-billing-payment`, payload);
export const syncBillingFromHisRequest = async (tokenId = "", payload = {}) => {
  const { data } = await apiClient.post(`/tokens/${tokenPath(tokenId)}/sync-billing-from-his`, payload);
  return data?.data ?? null;
};
export const updateBillingPaymentRequest = async (tokenId = "", paymentId = "", payload = {}) =>
  apiClient.patch(`/tokens/${tokenPath(tokenId)}/billing-payments/${paymentId}`, payload);
export const deleteBillingPaymentRequest = async (tokenId = "", paymentId = "") =>
  apiClient.delete(`/tokens/${tokenPath(tokenId)}/billing-payments/${paymentId}`);
export const startLabRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenPath(tokenId)}/start-lab`);
export const endLabRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenPath(tokenId)}/end-lab`);
export const startCareRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenPath(tokenId)}/start-treatment`);
export const endCareRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenPath(tokenId)}/end-treatment`);
export const completeVisitAfterConsultRequest = async (tokenId = "") =>
  apiClient.post(`/tokens/${tokenPath(tokenId)}/complete-visit`);
export const branchTokenRequest = async (tokenId = "", payload = {}) =>
  apiClient.post(`/tokens/${tokenPath(tokenId)}/branch`, payload);
