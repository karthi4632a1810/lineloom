import { ApiError } from "../utils/apiError.js";
import { rowsToCsv } from "../utils/csvExport.js";
import { getPatientRecord, searchPatientRecords } from "./patientRecordService.js";

const REPORT_COLUMNS = [
  { key: "patient_id", label: "Patient ID" },
  { key: "patient_name", label: "Patient Name" },
  { key: "phone", label: "Phone" },
  { key: "master_reg", label: "Master Reg (iReg_No)" },
  { key: "sex", label: "Sex" },
  { key: "dob", label: "DOB" },
  { key: "visit_id", label: "Visit / OP Reg" },
  { key: "token_id", label: "Token ID" },
  { key: "department", label: "Department" },
  { key: "visit_type", label: "Visit Type" },
  { key: "status", label: "Status" },
  { key: "phase", label: "Phase" },
  { key: "tracked", label: "NexaFlow Tracked" },
  { key: "admission_at", label: "Admission" },
  { key: "visit_completed_at", label: "Visit Completed" },
  { key: "waiting_tat_min", label: "Waiting TAT (min)" },
  { key: "consult_tat_min", label: "Consult TAT (min)" },
  { key: "lab_wait_tat_min", label: "Lab Wait TAT (min)" },
  { key: "lab_test_tat_min", label: "Lab Test TAT (min)" },
  { key: "treatment_tat_min", label: "Treatment TAT (min)" },
  { key: "pharmacy_tat_min", label: "Pharmacy TAT (min)" },
  { key: "billing_tat_min", label: "Billing TAT (min)" },
  { key: "overall_tat_min", label: "Overall TAT (min)" },
  { key: "overall_visit_min", label: "Visit TAT (min)" },
  { key: "billing_paid", label: "Billing Paid (INR)" },
  { key: "post_consult_plans", label: "Post-Consult Plans" },
  { key: "consult_note", label: "Consult Note" },
  { key: "referral", label: "Referral Department" },
  { key: "pharmacy_sessions", label: "Pharmacy Sessions" },
  { key: "lab_sessions", label: "Lab Sessions" }
];

const formatIso = (value = null) => {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const formatNum = (value = null) => {
  if (value == null || value === "") {
    return "";
  }
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : "";
};

const encounterMs = (encounter = {}) => {
  const raw = encounter?.occurred_at ?? encounter?.admission ?? null;
  if (!raw) {
    return null;
  }
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
};

const inDateRange = (encounter = {}, dateFrom = "", dateTo = "") => {
  const ms = encounterMs(encounter);
  if (ms == null) {
    return !dateFrom && !dateTo;
  }
  if (dateFrom) {
    const fromMs = new Date(`${dateFrom}T00:00:00.000`).getTime();
    if (Number.isFinite(fromMs) && ms < fromMs) {
      return false;
    }
  }
  if (dateTo) {
    const toMs = new Date(`${dateTo}T23:59:59.999`).getTime();
    if (Number.isFinite(toMs) && ms > toMs) {
      return false;
    }
  }
  return true;
};

const encounterToReportRow = (record = {}, encounter = {}) => {
  const patient = record?.patient ?? {};
  const tt = encounter?.time_tracking ?? {};
  const tat = encounter?.tat ?? {};
  return {
    patient_id: patient.patient_id ?? encounter.patient_id ?? "",
    patient_name: encounter.patient_name ?? patient.name ?? "",
    phone: encounter.patient_phone ?? patient.phone ?? "",
    master_reg: patient.patient_reg_no ?? patient.i_reg_no ?? encounter.i_reg_no ?? "",
    sex: patient.sex ?? encounter.sex ?? "",
    dob: patient.dob ?? encounter.dob ?? "",
    visit_id: encounter.visit_id ?? "",
    token_id: encounter.token_id ?? "",
    department: encounter.department ?? "",
    visit_type: encounter.type ?? "",
    status: encounter.status ?? "",
    phase: encounter.phase_label ?? encounter.phase ?? "",
    tracked: encounter.flags?.tracked ? "Yes" : "No",
    admission_at: formatIso(encounter.admission ?? encounter.occurred_at),
    visit_completed_at: formatIso(tt.visit_completed_at),
    waiting_tat_min: formatNum(tat.waiting_tat_minutes),
    consult_tat_min: formatNum(tat.consulting_tat_minutes),
    lab_wait_tat_min: formatNum(tat.lab_wait_tat_minutes),
    lab_test_tat_min: formatNum(tat.lab_test_tat_minutes),
    treatment_tat_min: formatNum(tat.treatment_tat_minutes),
    pharmacy_tat_min: formatNum(tat.pharmacy_tat_minutes),
    billing_tat_min: formatNum(tat.billing_tat_minutes),
    overall_tat_min: formatNum(tat.overall_tat_minutes),
    overall_visit_min: formatNum(tat.overall_visit_minutes),
    billing_paid: formatNum(encounter?.billing?.paid_amount),
    post_consult_plans: Array.isArray(tt.post_consult_plans)
      ? tt.post_consult_plans.join("; ")
      : "",
    consult_note: encounter.consult_note ?? "",
    referral: encounter.referred_department ?? "",
    pharmacy_sessions: formatNum(encounter?.workflow_counts?.pharmacy_sessions),
    lab_sessions: formatNum(encounter?.workflow_counts?.lab_sessions)
  };
};

const collectPatientIds = async (filters = {}) => {
  const patientId = String(filters.patient_id ?? "").trim();
  if (patientId) {
    return [patientId];
  }
  const searchRows = await searchPatientRecords(filters);
  return [...new Set(searchRows.map((row) => String(row?.patient_id ?? "").trim()).filter(Boolean))];
};

/**
 * @param {{ patient_id?: string, name?: string, reg_no?: string, date_from?: string, date_to?: string }} filters
 */
export const buildPatientReportRows = async (filters = {}) => {
  const dateFrom = String(filters.date_from ?? "").trim();
  const dateTo = String(filters.date_to ?? "").trim();
  const patientId = String(filters.patient_id ?? "").trim();

  if (!patientId && (!dateFrom || !dateTo)) {
    throw new ApiError("Set admission from and to dates for bulk report, or choose one patient", 400);
  }

  const patientIds = await collectPatientIds(filters);
  if (!patientIds.length) {
    throw new ApiError("No patients matched the report filters", 404);
  }

  const maxPatients = patientId ? 1 : 150;
  const rows = [];

  for (const id of patientIds.slice(0, maxPatients)) {
    let record;
    try {
      record = await getPatientRecord(id);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        continue;
      }
      throw error;
    }
    const encounters = Array.isArray(record?.encounters) ? record.encounters : [];
    for (const encounter of encounters) {
      if (!inDateRange(encounter, dateFrom, dateTo)) {
        continue;
      }
      rows.push(encounterToReportRow(record, encounter));
    }
  }

  if (!rows.length) {
    throw new ApiError("No visits in the selected date range", 404);
  }

  rows.sort((a, b) => String(b.admission_at).localeCompare(String(a.admission_at)));
  return rows;
};

export const buildPatientReportCsv = async (filters = {}) => {
  const rows = await buildPatientReportRows(filters);
  return rowsToCsv(REPORT_COLUMNS, rows);
};

export const buildPatientReportFilename = (filters = {}) => {
  const patientId = String(filters.patient_id ?? "").trim();
  const from = String(filters.date_from ?? "").trim() || "all";
  const to = String(filters.date_to ?? "").trim() || "all";
  if (patientId) {
    return `nexaflow-patient-${patientId}-${from}-to-${to}.csv`;
  }
  return `nexaflow-patients-${from}-to-${to}.csv`;
};
