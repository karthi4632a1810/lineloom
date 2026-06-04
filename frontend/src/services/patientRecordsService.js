import { apiClient } from "./apiClient";

/**
 * Combined HIS + NexaFlow (MongoDB) patient search for Patient Records.
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

/**
 * Download CSV patient report (bulk or single patient) for a date range.
 * @param {{ patient_id?: string, name?: string, reg_no?: string, date_from?: string, date_to?: string }} filters
 */
export const downloadPatientReport = async (filters = {}) => {
  const response = await apiClient.get("/patients/report/download", {
    params: {
      patient_id: filters.patient_id ?? "",
      name: filters.name ?? "",
      reg_no: filters.reg_no ?? "",
      date_from: filters.date_from ?? "",
      date_to: filters.date_to ?? ""
    },
    responseType: "blob",
    timeout: 120000
  });
  const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
  const from = String(filters.date_from ?? "").trim() || "all";
  const to = String(filters.date_to ?? "").trim() || "all";
  const patientId = String(filters.patient_id ?? "").trim();
  const filename = patientId
    ? `nexaflow-patient-${patientId}-${from}-to-${to}.csv`
    : `nexaflow-patients-${from}-to-${to}.csv`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
