import { apiClient } from "./apiClient";

export const fetchActiveDepartments = async () => {
  const { data } = await apiClient.get("/departments");
  return data?.data ?? [];
};

export const fetchAllDepartments = async () => {
  const { data } = await apiClient.get("/departments/all");
  return data?.data ?? [];
};

export const createDepartmentRequest = async (payload = {}) => {
  const { data } = await apiClient.post("/departments", payload);
  return data?.data ?? null;
};

export const updateDepartmentRequest = async (id = "", payload = {}) => {
  const { data } = await apiClient.patch(`/departments/${id}`, payload);
  return data?.data ?? null;
};

export const deleteDepartmentRequest = async (id = "") => {
  const { data } = await apiClient.delete(`/departments/${id}`);
  return data?.data ?? null;
};
