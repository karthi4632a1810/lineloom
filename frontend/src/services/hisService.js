import { apiClient } from "./apiClient";

export const fetchHisPatients = async () => {
  const { data } = await apiClient.get("/his/patients");
  return data?.data ?? [];
};

/**
 * @param {{ patient_id?: string, name?: string, reg_no?: string, date_from?: string, date_to?: string }} filters
 */
export const searchHisPatients = async (filters = {}) => {
  const { data } = await apiClient.get("/his/patients/search", {
    params: {
      patient_id: filters.patient_id ?? "",
      name: filters.name ?? "",
      reg_no: filters.reg_no ?? "",
      date_from: filters.date_from ?? "",
      date_to: filters.date_to ?? ""
    }
  });
  return data?.data ?? [];
};
