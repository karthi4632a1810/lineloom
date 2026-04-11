import { Token } from "../models/Token.js";
import { TimeTracking } from "../models/TimeTracking.js";
import { resolveEffectiveTreatmentStart } from "../utils/timeMetrics.js";

const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const average = (items = []) => {
  if (!items.length) {
    return 0;
  }
  return Number((items.reduce((sum, value) => sum + value, 0) / items.length).toFixed(2));
};

const parseDateOrDefault = (value = "", fallback = null) => {
  const parsed = value ? new Date(value) : fallback;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return fallback;
  }
  return parsed;
};

const resolveTimeRange = async (filters = {}) => {
  const tokens = await Token.find({
    created_at: {
      $gte: parseDateOrDefault(filters?.from, getTodayRange().start),
      $lt: parseDateOrDefault(filters?.to, getTodayRange().end)
    }
  })
    .sort({ created_at: 1 })
    .lean();
  return tokens;
};

const minutesBetween = (start = null, end = null, useNowIfMissingEnd = false) => {
  if (!start) {
    return null;
  }
  const endDate = end ?? (useNowIfMissingEnd ? new Date() : null);
  if (!endDate) {
    return null;
  }
  const ms = Math.max(new Date(endDate).getTime() - new Date(start).getTime(), 0);
  return Number((ms / 60000).toFixed(2));
};

export const buildTatMetrics = (tracking = {}, status = "WAITING") => {
  const waiting = minutesBetween(
    tracking.waiting_start,
    tracking.consult_start,
    status === "WAITING"
  );
  const consulting = minutesBetween(
    tracking.consult_start,
    tracking.consult_end,
    status === "CONSULTING"
  );
  const billing = minutesBetween(
    tracking.billing_start,
    tracking.billing_end,
    status === "CONSULTING" && Boolean(tracking.billing_start) && !tracking.billing_end
  );
  const labWait = minutesBetween(
    tracking.billing_end,
    tracking.lab_start,
    status === "CONSULTING" && Boolean(tracking.billing_end) && !tracking.lab_start
  );
  const labTest = minutesBetween(
    tracking.lab_start,
    tracking.lab_end,
    status === "CONSULTING" && Boolean(tracking.lab_start) && !tracking.lab_end
  );
  const treatmentStart = resolveEffectiveTreatmentStart(tracking.care_start, tracking.consult_end);
  const treatment = minutesBetween(
    treatmentStart,
    tracking.care_end,
    status === "IN_TREATMENT"
  );
  const overall = [waiting, consulting, billing, labWait, labTest, treatment]
    .filter((value) => value != null)
    .reduce((sum, value) => sum + value, 0);
  return {
    waiting_tat_minutes: waiting,
    consulting_tat_minutes: consulting,
    billing_tat_minutes: billing,
    lab_wait_tat_minutes: labWait,
    lab_test_tat_minutes: labTest,
    treatment_tat_minutes: treatment,
    overall_tat_minutes: Number(overall.toFixed(2))
  };
};

export const getDashboardSummary = async (filters = {}) => {
  const tokens = await resolveTimeRange(filters);
  const tokenIds = tokens.map((token) => token.token_id);
  const trackingRows = await TimeTracking.find({
    token_id: { $in: tokenIds }
  }).lean();
  const trackingByToken = trackingRows.reduce((acc, row) => {
    acc[row.token_id] = row;
    return acc;
  }, {});

  const metricRows = tokens.map((token) => buildTatMetrics(trackingByToken[token.token_id], token.status));
  const waitingTimes = metricRows
    .map((row) => row.waiting_tat_minutes)
    .filter((value) => value != null);
  const consultTimes = metricRows
    .map((row) => row.consulting_tat_minutes)
    .filter((value) => value != null);

  return {
    total_patients_today: tokens.length,
    waiting_patient_count: tokens.filter((token) => token.status === "WAITING" || token.status === "ACTIVE")
      .length,
    patient_in_consulting_count: tokens.filter((token) => token.status === "CONSULTING").length,
    patient_in_treatment_count: tokens.filter((token) => token.status === "IN_TREATMENT").length,
    patient_completed_count: tokens.filter((token) => token.status === "COMPLETED").length,
    avg_waiting_time_minutes: average(waitingTimes),
    avg_consultation_time_minutes: average(consultTimes),
    department_wise_stats: Object.values(
      tokens.reduce((acc, token) => {
        const current = acc[token.department] ?? { department: token.department, total: 0 };
        current.total += 1;
        acc[token.department] = current;
        return acc;
      }, {})
    )
  };
};

export const getDashboardTokens = async (filters = {}) => {
  const tokens = await resolveTimeRange(filters);
  const tokenIds = tokens.map((token) => token.token_id);
  const trackingRows = await TimeTracking.find({ token_id: { $in: tokenIds } }).lean();
  const trackingByToken = trackingRows.reduce((acc, row) => {
    acc[row.token_id] = row;
    return acc;
  }, {});
  const search = String(filters?.search ?? "").toLowerCase().trim();
  const departmentFilter = String(filters?.department ?? "").trim();

  return tokens
    .map((token) => {
      const tracking = trackingByToken[token.token_id] ?? {};
      return {
        token_id: token.token_id,
        patient_id: token.patient_id,
        visit_id: token.visit_id,
        name: token.patient_name || `Patient ${token.patient_id}`,
        phone: token.patient_phone || "",
        department: token.department,
        status: token.status === "ACTIVE" ? "WAITING" : token.status,
        waiting_start: tracking.waiting_start ?? null,
        consult_start: tracking.consult_start ?? null,
        consult_end: tracking.consult_end ?? null,
        treatment_start: tracking.care_start ?? null,
        treatment_end: tracking.care_end ?? null,
        billing_start: tracking.billing_start ?? null,
        billing_end: tracking.billing_end ?? null,
        lab_start: tracking.lab_start ?? null,
        lab_end: tracking.lab_end ?? null,
        consult_note: tracking.consult_note ?? "",
        referred_department: tracking.referred_department ?? "",
        created_at: token.created_at,
        ...buildTatMetrics(tracking, token.status)
      };
    })
    .filter((row) => {
      const matchesSearch =
        !search ||
        row.patient_id.toLowerCase().includes(search) ||
        row.visit_id.toLowerCase().includes(search) ||
        row.name.toLowerCase().includes(search) ||
        row.department.toLowerCase().includes(search);
      const matchesDepartment = !departmentFilter || row.department === departmentFilter;
      return matchesSearch && matchesDepartment;
    });
};
