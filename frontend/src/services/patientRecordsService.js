import { apiClient } from "./apiClient";

export const fetchPatientRecord = async (patientId = "") => {
  const id = String(patientId ?? "").trim();
  if (!id) {
    return null;
  }
  const { data } = await apiClient.get(`/patients/${encodeURIComponent(id)}/records`);
  return data?.data ?? null;
};
