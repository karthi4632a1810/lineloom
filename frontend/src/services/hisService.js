import { apiClient } from "./apiClient";

export const fetchHisPatients = async () => {
  const { data } = await apiClient.get("/his/patients");
  return data?.data ?? [];
};

export const searchHisPatients = async (search = "") => {
  const { data } = await apiClient.get("/his/patients/search", {
    params: { q: search ?? "" }
  });
  return data?.data ?? [];
};
