import { apiClient } from "./apiClient";

export const loginRequest = async (payload = {}) => {
  const { data } = await apiClient.post("/auth/login", payload);
  return data?.data ?? null;
};

export const registerRequest = async (payload = {}) => {
  const { data } = await apiClient.post("/auth/register", payload);
  return data?.data ?? null;
};
