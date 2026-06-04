import { apiClient } from "./apiClient";

/**
 * Combined HIS + LineLoom (MongoDB) patient search for Patient Records.
 */
export const searchPatientRecords = async (filters = {}) => {
  const { data } = await apiClient.get("/patients/search", {
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

export const fetchPatientRecord = async (patientId = "") => {
  const id = String(patientId ?? "").trim();
  if (!id) {
    return null;
  }
  const { data } = await apiClient.get(`/patients/${encodeURIComponent(id)}/records`);
  return data?.data ?? null;
};
