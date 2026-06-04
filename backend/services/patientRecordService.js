import { Token } from "../models/Token.js";
import { TimeTracking } from "../models/TimeTracking.js";
import { ApiError } from "../utils/apiError.js";
import { calculateTimeMetrics } from "../utils/timeMetrics.js";
import { buildTatMetrics } from "./dashboardService.js";
import {
  fetchPatientDemographics,
  fetchPatientVisitHistory,
  searchHisPatients
} from "./hisService.js";
import { detectVisitStage } from "./revertMilestones.js";

const toIso = (value = null) => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const toDisplayStatus = (status = "") => {
  const normalized = String(status ?? "").trim().toUpperCase();
  return normalized === "ACTIVE" ? "WAITING" : normalized;
};

const toNumber = (value = 0) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizeTreatmentLogs = (logs = []) =>
  (Array.isArray(logs) ? logs : [])
    .map((entry, index) => ({
      id: `${index}`,
      start: toIso(entry?.start),
      end: toIso(entry?.end)
    }))
    .filter((entry) => entry.start);

const normalizeLabLogs = (logs = []) =>
  (Array.isArray(logs) ? logs : []).map((entry, index) => ({
    id: `${index}`,
    request_no: String(entry?.request_no ?? "").trim(),
    procedure: String(entry?.procedure ?? "").trim(),
    dept: String(entry?.dept ?? "").trim(),
    status: String(entry?.status ?? "").trim(),
    request_at: toIso(entry?.request_at),
    sample_received_at: toIso(entry?.sample_received_at),
    completed_at: toIso(entry?.completed_at),
    start: toIso(entry?.start),
    end: toIso(entry?.end)
  }));

const normalizePharmacyLogs = (logs = []) =>
  (Array.isArray(logs) ? logs : []).map((entry, index) => ({
    id: `${index}`,
    bill_no: String(entry?.bill_no ?? "").trim(),
    request_no: String(entry?.request_no ?? "").trim(),
    issue_type: String(entry?.issue_type ?? "").trim(),
    dept: String(entry?.dept ?? "").trim(),
    request_at: toIso(entry?.request_at),
    bill_at: toIso(entry?.bill_at),
    completed_at: toIso(entry?.completed_at),
    start: toIso(entry?.start),
    end: toIso(entry?.end)
  }));

const normalizePayments = (payments = []) =>
  (Array.isArray(payments) ? payments : [])
    .map((entry, index) => ({
      id: String(entry?._id ?? index),
      amount: toNumber(entry?.amount),
      paid_at: toIso(entry?.paid_at),
      note: String(entry?.note ?? "").trim(),
      label: String(entry?.label ?? "").trim()
    }))
    .filter((entry) => entry.amount > 0 || entry.paid_at);

const getEncounterDisplaySortMs = (row = {}) => {
  const primary = new Date(row?.occurred_at ?? row?.admission ?? 0).getTime();
  if (Number.isFinite(primary) && primary > 0) {
    return primary;
  }
  const fallback = new Date(row?.updated_at ?? row?.created_at ?? 0).getTime();
  return Number.isFinite(fallback) ? fallback : 0;
};

const sortByNewest = (rows = []) =>
  [...rows].sort((left, right) => {
    const primaryDiff = getEncounterDisplaySortMs(right) - getEncounterDisplaySortMs(left);
    if (primaryDiff !== 0) {
      return primaryDiff;
    }
    const a = new Date(left?.updated_at ?? left?.created_at ?? 0).getTime();
    const b = new Date(right?.updated_at ?? right?.created_at ?? 0).getTime();
    return (Number.isFinite(b) ? b : 0) - (Number.isFinite(a) ? a : 0);
  });

const pickLatestValue = (...values) =>
  values.find((value) => {
    if (typeof value === "string") {
      return value.trim().length > 0;
    }
    return value != null;
  }) ?? "";

const normalizePatientId = (value = "") => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return "";
  }
  if (!/^\d+$/.test(trimmed)) {
    return trimmed;
  }
  const normalized = trimmed.replace(/^0+/, "");
  return normalized || "0";
};

const buildPatientIdVariants = (value = "") =>
  [...new Set([String(value ?? "").trim(), normalizePatientId(value)].filter(Boolean))];

const PHASE_LABELS = {
  completed: "Completed",
  waiting: "Waiting",
  consult_open: "In consulting",
  consult_closed: "Consult ended",
  lab: "Lab testing",
  lab_done: "Post-lab",
  treatment: "In treatment"
};

const getEncounterWhen = (token = {}, hisVisit = null) =>
  toIso(token?.created_at) ?? toIso(hisVisit?.visit_datetime) ?? toIso(hisVisit?.admission);

const buildTrackingPayload = (tracking = {}) => {
  const billing_payments = normalizePayments(tracking?.billing_payments);
  return {
    waiting_start: toIso(tracking?.waiting_start),
    consult_start: toIso(tracking?.consult_start),
    consult_end: toIso(tracking?.consult_end),
    care_start: toIso(tracking?.care_start),
    care_end: toIso(tracking?.care_end),
    billing_start: toIso(tracking?.billing_start),
    billing_end: toIso(tracking?.billing_end),
    billing_elapsed_ms: toNumber(tracking?.billing_elapsed_ms),
    billing_total_amount: toNumber(tracking?.billing_total_amount),
    billing_paid_amount:
      toNumber(tracking?.billing_paid_amount) ||
      Number(billing_payments.reduce((sum, entry) => sum + toNumber(entry.amount), 0).toFixed(2)),
    billing_payments,
    labs_ordered: Boolean(tracking?.labs_ordered),
    post_consult_plans: Array.isArray(tracking?.post_consult_plans)
      ? tracking.post_consult_plans.map((entry) => String(entry ?? "").trim()).filter(Boolean)
      : [],
    lab_start: toIso(tracking?.lab_start),
    lab_end: toIso(tracking?.lab_end),
    lab_logs: normalizeLabLogs(tracking?.lab_logs),
    pharmacy_start: toIso(tracking?.pharmacy_start),
    pharmacy_end: toIso(tracking?.pharmacy_end),
    pharmacy_elapsed_ms: toNumber(tracking?.pharmacy_elapsed_ms),
    pharmacy_logs: normalizePharmacyLogs(tracking?.pharmacy_logs),
    treatment_logs: normalizeTreatmentLogs(tracking?.treatment_logs),
    consult_note: String(tracking?.consult_note ?? "").trim(),
    referred_department: String(tracking?.referred_department ?? "").trim(),
    break_start: toIso(tracking?.break_start),
    break_end: toIso(tracking?.break_end),
    visit_completed_at: toIso(tracking?.visit_completed_at)
  };
};

const buildTokenPayload = (token = {}) => ({
  token_id: String(token?.token_id ?? "").trim(),
  patient_id: String(token?.patient_id ?? "").trim(),
  visit_id: String(token?.visit_id ?? "").trim(),
  patient_reg_no: String(token?.patient_reg_no ?? "").trim(),
  patient_name: String(token?.patient_name ?? "").trim(),
  patient_phone: String(token?.patient_phone ?? "").trim(),
  department: String(token?.department ?? "").trim(),
  department_queue_no:
    token?.department_queue_no == null ? null : Number(token.department_queue_no),
  parent_token_id: String(token?.parent_token_id ?? "").trim() || null,
  status: toDisplayStatus(token?.status),
  created_at: toIso(token?.created_at),
  updated_at: toIso(token?.updated_at)
});

const buildTrackedEncounter = (token = {}, tracking = {}, hisVisit = null, fallbackDemo = {}) => {
  const status = toDisplayStatus(token?.status);
  const phase = detectVisitStage(tracking, status);
  const metrics = calculateTimeMetrics(tracking, status);
  const tat = buildTatMetrics(tracking, status);
  const time_tracking = buildTrackingPayload(tracking);
  const paymentTotal = Number(
    time_tracking.billing_payments.reduce((sum, entry) => sum + toNumber(entry.amount), 0).toFixed(2)
  );
  const patient_name = pickLatestValue(
    token?.patient_name,
    hisVisit?.c_pat_name,
    fallbackDemo?.name,
    `Patient ${token?.patient_id ?? ""}`
  );
  const patient_phone = pickLatestValue(token?.patient_phone, hisVisit?.phone, fallbackDemo?.phone);

  return {
    encounter_key: `token-${token.token_id}`,
    source: "tracked",
    token: buildTokenPayload(token),
    token_id: String(token?.token_id ?? ""),
    parent_token_id: pickLatestValue(token?.parent_token_id),
    patient_id: String(token?.patient_id ?? "").trim(),
    visit_id: String(token?.visit_id ?? "").trim(),
    department: pickLatestValue(token?.department, hisVisit?.department, hisVisit?.dept_name),
    department_queue_no:
      token?.department_queue_no == null ? null : Number(token.department_queue_no),
    status,
    phase,
    phase_label: PHASE_LABELS[phase] ?? status,
    patient_name,
    patient_phone,
    type: pickLatestValue(hisVisit?.type),
    admission: pickLatestValue(hisVisit?.admission),
    occurred_at: getEncounterWhen(token, hisVisit),
    updated_at: toIso(token?.updated_at),
    created_at: toIso(token?.created_at),
    i_reg_no: pickLatestValue(hisVisit?.i_reg_no),
    dob: pickLatestValue(hisVisit?.d_dob),
    sex: pickLatestValue(hisVisit?.c_sex),
    clinician_id: pickLatestValue(hisVisit?.i_user_id),
    clinician_name: pickLatestValue(hisVisit?.i_user_name),
    consult_note: time_tracking.consult_note,
    referred_department: time_tracking.referred_department,
    journey_available: true,
    flags: {
      tracked: true,
      has_consult_note: Boolean(time_tracking.consult_note),
      has_billing:
        Boolean(time_tracking.billing_start) ||
        Boolean(time_tracking.billing_end) ||
        time_tracking.billing_payments.length > 0 ||
        time_tracking.billing_total_amount > 0,
      has_lab:
        Boolean(time_tracking.labs_ordered) ||
        Boolean(time_tracking.lab_start) ||
        Boolean(time_tracking.lab_end) ||
        time_tracking.lab_logs.length > 0,
      has_pharmacy:
        Boolean(time_tracking.pharmacy_start) ||
        Boolean(time_tracking.pharmacy_end) ||
        time_tracking.pharmacy_logs.length > 0,
      has_treatment:
        Boolean(time_tracking.care_start) ||
        Boolean(time_tracking.care_end) ||
        time_tracking.treatment_logs.length > 0,
      has_referral: Boolean(time_tracking.referred_department)
    },
    workflow_counts: {
      lab_sessions: time_tracking.lab_logs.length,
      pharmacy_sessions: time_tracking.pharmacy_logs.length,
      treatment_sessions: time_tracking.treatment_logs.length,
      billing_payments: time_tracking.billing_payments.length
    },
    billing: {
      total_amount: time_tracking.billing_total_amount,
      paid_amount: time_tracking.billing_paid_amount || paymentTotal,
      payment_count: time_tracking.billing_payments.length
    },
    metrics,
    tat,
    time_tracking
  };
};

const buildHisOnlyEncounter = (visit = {}, fallbackDemo = {}) => ({
  encounter_key: `his-${String(visit?.visit_id ?? "").trim()}`,
  source: "his",
  token_id: "",
  parent_token_id: "",
  patient_id: String(visit?.patient_id ?? "").trim(),
  visit_id: String(visit?.visit_id ?? "").trim(),
  department: pickLatestValue(visit?.department, visit?.dept_name),
  department_queue_no: null,
  status: "HIS_ONLY",
  phase: "his_only",
  phase_label: "HIS ONLY",
  patient_name: pickLatestValue(visit?.c_pat_name, fallbackDemo?.name, `Patient ${visit?.patient_id ?? ""}`),
  patient_phone: pickLatestValue(visit?.phone, fallbackDemo?.phone),
  type: pickLatestValue(visit?.type),
  admission: pickLatestValue(visit?.admission),
  occurred_at: toIso(visit?.visit_datetime) ?? toIso(visit?.admission),
  updated_at: null,
  created_at: null,
  i_reg_no: pickLatestValue(visit?.i_reg_no),
  dob: pickLatestValue(visit?.d_dob),
  sex: pickLatestValue(visit?.c_sex),
  clinician_id: pickLatestValue(visit?.i_user_id),
  clinician_name: pickLatestValue(visit?.i_user_name),
  consult_note: "",
  referred_department: "",
  journey_available: false,
  flags: {
    tracked: false,
    has_consult_note: false,
    has_billing: false,
    has_lab: false,
    has_pharmacy: false,
    has_treatment: false,
    has_referral: false
  },
  workflow_counts: {
    lab_sessions: 0,
    pharmacy_sessions: 0,
    treatment_sessions: 0,
    billing_payments: 0
  },
  billing: {
    total_amount: 0,
    paid_amount: 0,
    payment_count: 0
  },
  metrics: {
    waiting_time_minutes: null,
    consult_time_minutes: null,
    care_time_minutes: null,
    break_time_minutes: null,
    billing_time_minutes: null,
    lab_wait_time_minutes: null,
    lab_test_time_minutes: null
  },
  tat: {
    waiting_tat_minutes: null,
    consulting_tat_minutes: null,
    billing_tat_minutes: null,
    lab_wait_tat_minutes: null,
    lab_test_tat_minutes: null,
    treatment_tat_minutes: null,
    break_tat_minutes: null,
    overall_tat_minutes: null
  },
  time_tracking: {
    waiting_start: null,
    consult_start: null,
    consult_end: null,
    care_start: null,
    care_end: null,
    billing_start: null,
    billing_end: null,
    billing_elapsed_ms: 0,
    billing_total_amount: 0,
    billing_paid_amount: 0,
    billing_payments: [],
    labs_ordered: false,
    post_consult_plans: [],
    lab_start: null,
    lab_end: null,
    lab_logs: [],
    pharmacy_start: null,
    pharmacy_end: null,
    pharmacy_elapsed_ms: 0,
    pharmacy_logs: [],
    treatment_logs: [],
    consult_note: "",
    referred_department: "",
    break_start: null,
    break_end: null
  }
});

export const getPatientRecord = async (patientId = "") => {
  const id = String(patientId ?? "").trim();
  if (!id) {
    throw new ApiError("Patient id is required", 400);
  }
  const patientIdVariants = buildPatientIdVariants(id);

  const [tokens, hisVisits, demographicsById] = await Promise.all([
    Token.find({ patient_id: { $in: patientIdVariants } }).sort({ created_at: -1, updated_at: -1 }).lean(),
    fetchPatientVisitHistory(id).catch(() => []),
    fetchPatientDemographics(patientIdVariants)
  ]);

  const demo =
    patientIdVariants.map((variant) => demographicsById[variant]).find(Boolean) ?? {};

  if (!tokens.length && !hisVisits.length && !demo?.name && !demo?.phone) {
    throw new ApiError("Patient not found", 404);
  }

  const tokenIds = tokens.map((token) => String(token?.token_id ?? "").trim()).filter(Boolean);
  const trackingRows = tokenIds.length
    ? await TimeTracking.find({ token_id: { $in: tokenIds } }).lean()
    : [];
  const trackingByTokenId = trackingRows.reduce((acc, row) => {
    acc[String(row?.token_id ?? "").trim()] = row;
    return acc;
  }, {});
  const hisByVisitId = hisVisits.reduce((acc, row) => {
    const key = String(row?.visit_id ?? "").trim();
    if (key && !acc[key]) {
      acc[key] = row;
    }
    return acc;
  }, {});

  const trackedEncounters = tokens.map((token) =>
    buildTrackedEncounter(
      token,
      trackingByTokenId[String(token?.token_id ?? "").trim()] ?? {},
      hisByVisitId[String(token?.visit_id ?? "").trim()] ?? null,
      demo
    )
  );
  const trackedVisitIds = new Set(trackedEncounters.map((entry) => entry.visit_id).filter(Boolean));
  const hisOnlyEncounters = hisVisits
    .filter((visit) => !trackedVisitIds.has(String(visit?.visit_id ?? "").trim()))
    .map((visit) => buildHisOnlyEncounter(visit, demo));
  const encounters = sortByNewest([...trackedEncounters, ...hisOnlyEncounters]);

  const latest = encounters[0] ?? null;
  const allVisitIds = new Set(encounters.map((entry) => entry.visit_id).filter(Boolean));
  const departmentsVisited = [
    ...new Set(encounters.map((entry) => String(entry?.department ?? "").trim()).filter(Boolean))
  ];
  const mongoTokens = tokens.map((token) => {
    const tokenId = String(token?.token_id ?? "").trim();
    return {
      ...buildTokenPayload(token),
      time_tracking: buildTrackingPayload(trackingByTokenId[tokenId] ?? {})
    };
  });

  return {
    patient: {
      patient_id: pickLatestValue(latest?.patient_id, id),
      name: pickLatestValue(latest?.patient_name, demo?.name),
      phone: pickLatestValue(latest?.patient_phone, demo?.phone),
      dob: pickLatestValue(latest?.dob, demo?.dob),
      sex: pickLatestValue(latest?.sex, demo?.sex),
      i_reg_no: pickLatestValue(
        latest?.i_reg_no,
        demo?.i_reg_no,
        ...tokens.map((row) => row?.patient_reg_no)
      ),
      patient_reg_no: pickLatestValue(
        ...tokens.map((row) => row?.patient_reg_no),
        latest?.i_reg_no,
        demo?.i_reg_no
      ),
      last_seen_at: pickLatestValue(latest?.occurred_at, latest?.admission),
      latest_visit_id: pickLatestValue(latest?.visit_id),
      latest_department: pickLatestValue(latest?.department),
      latest_status: pickLatestValue(latest?.status),
      mongodb_token_count: tokens.length
    },
    mongodb: {
      tokens: mongoTokens
    },
    summary: {
      total_visits: allVisitIds.size,
      tracked_encounters: trackedEncounters.length,
      completed_encounters: trackedEncounters.filter((entry) => entry.phase === "completed").length,
      active_encounters: trackedEncounters.filter((entry) => entry.phase !== "completed").length,
      his_only_visits: hisOnlyEncounters.length,
      departments_visited: departmentsVisited.length,
      latest_token_id: pickLatestValue(latest?.token_id),
      latest_status: pickLatestValue(latest?.phase_label, latest?.status),
      latest_department: pickLatestValue(latest?.department),
      last_seen_at: pickLatestValue(latest?.occurred_at, latest?.admission)
    },
    encounters
  };
};

const escapeRegex = (value = "") => String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const visitRowKey = (patientId = "", visitId = "") =>
  `${String(patientId ?? "").trim()}:${String(visitId ?? "").trim()}`;

const mapTokenToSearchRow = (token = {}) => {
  const createdAt = toIso(token?.created_at);
  return {
    patient_id: String(token?.patient_id ?? "").trim(),
    visit_id: String(token?.visit_id ?? "").trim(),
    i_reg_no: String(token?.patient_reg_no ?? "").trim(),
    c_pat_name: String(token?.patient_name ?? "").trim(),
    name: String(token?.patient_name ?? "").trim(),
    d_dob: "",
    c_sex: "",
    dept_name: String(token?.department ?? "").trim(),
    department: String(token?.department ?? "").trim(),
    admission: createdAt,
    visit_datetime: createdAt,
    type: "NexaFlow",
    token_id: String(token?.token_id ?? "").trim(),
    token_status: toDisplayStatus(token?.status),
    tracked: true,
    source: "lineloom"
  };
};

/** Search tokens collection (MongoDB) using the same filters as HIS patient search. */
export const searchLineloomTokens = async (filters = {}) => {
  const patientId = String(filters.patient_id ?? "").trim();
  const name = String(filters.name ?? "").trim();
  const regNo = String(filters.reg_no ?? "").trim();
  const dateFrom = String(filters.date_from ?? "").trim();
  const dateTo = String(filters.date_to ?? "").trim();

  if (!patientId && !name && !regNo && !dateFrom && !dateTo) {
    return [];
  }

  const clauses = [];

  if (patientId) {
    const variants = buildPatientIdVariants(patientId);
    const idPattern = escapeRegex(patientId);
    clauses.push({
      $or: [
        { patient_id: { $in: variants } },
        { visit_id: { $regex: idPattern, $options: "i" } },
        { patient_reg_no: { $regex: idPattern, $options: "i" } },
        { token_id: { $regex: idPattern, $options: "i" } }
      ]
    });
  }
  if (name) {
    clauses.push({ patient_name: { $regex: escapeRegex(name), $options: "i" } });
  }
  if (regNo) {
    const regPattern = escapeRegex(regNo);
    clauses.push({
      $or: [
        { visit_id: { $regex: regPattern, $options: "i" } },
        { patient_reg_no: { $regex: regPattern, $options: "i" } }
      ]
    });
  }
  if (dateFrom || dateTo) {
    const range = {};
    if (dateFrom) {
      range.$gte = new Date(`${dateFrom}T00:00:00.000`);
    }
    if (dateTo) {
      range.$lte = new Date(`${dateTo}T23:59:59.999`);
    }
    clauses.push({ created_at: range });
  }

  const query = clauses.length ? { $and: clauses } : {};
  const tokens = await Token.find(query).sort({ created_at: -1 }).limit(50).lean();
  return tokens.map(mapTokenToSearchRow);
};

/**
 * Merges HIS admissions with LineLoom tokens so Patient Records search shows both sources.
 */
export const searchPatientRecords = async (filters = {}) => {
  const hasAnyFilter = Object.values(filters).some((value) => String(value ?? "").trim());
  if (!hasAnyFilter) {
    return [];
  }

  const [hisRows, lineloomRows] = await Promise.all([
    searchHisPatients(filters).catch(() => []),
    searchLineloomTokens(filters)
  ]);

  const merged = new Map();

  for (const row of hisRows) {
    const key = visitRowKey(row.patient_id, row.visit_id);
    merged.set(key, {
      ...row,
      token_id: "",
      token_status: "",
      tracked: false,
      source: "his"
    });
  }

  for (const row of lineloomRows) {
    const key = visitRowKey(row.patient_id, row.visit_id);
    const existing = merged.get(key);
    if (existing) {
      merged.set(key, {
        ...existing,
        token_id: row.token_id || existing.token_id,
        token_status: row.token_status || existing.token_status,
        tracked: true,
        source: "both",
        dept_name: pickLatestValue(existing.dept_name, row.dept_name),
        department: pickLatestValue(existing.department, row.department),
        c_pat_name: pickLatestValue(existing.c_pat_name, row.c_pat_name),
        i_reg_no: pickLatestValue(existing.i_reg_no, row.i_reg_no)
      });
      continue;
    }
    merged.set(key, { ...row });
  }

  return [...merged.values()].sort((left, right) => {
    const leftMs = new Date(left?.admission ?? left?.visit_datetime ?? 0).getTime();
    const rightMs = new Date(right?.admission ?? right?.visit_datetime ?? 0).getTime();
    return (Number.isFinite(rightMs) ? rightMs : 0) - (Number.isFinite(leftMs) ? leftMs : 0);
  });
};
