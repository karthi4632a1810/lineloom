import { Token } from "../models/Token.js";
import { TimeTracking } from "../models/TimeTracking.js";
import { DepartmentFlow } from "../models/DepartmentFlow.js";
import { ApiError } from "../utils/apiError.js";
import { calculateTimeMetrics } from "../utils/timeMetrics.js";
import { generateTokenId } from "../utils/tokenId.js";
import { buildTatMetrics } from "./dashboardService.js";
import { isActiveDepartmentName } from "./departmentService.js";
import {
  assertRevertAllowed,
  buildRevertPatchForAnchor,
  detectVisitStage,
  resolveStatusAfterRevert
} from "./revertMilestones.js";
import { fetchPatientDemographics } from "./hisService.js";

const sendDebugLog = (hypothesisId = "", message = "", data = {}) => {
  // #region agent log
  fetch("http://127.0.0.1:7922/ingest/204861d7-45da-4112-b57a-5e4addac40db", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "c166b2" },
    body: JSON.stringify({
      sessionId: "c166b2",
      runId: "sql-mongo-check-pre",
      hypothesisId,
      location: "backend/services/tokenService.js",
      message,
      data,
      timestamp: Date.now()
    })
  }).catch(() => {});
  // #endregion
};

const ensureTrackingRecord = async (tokenId = "") => {
  const existing = await TimeTracking.findOne({ token_id: tokenId }).lean();
  if (existing) {
    return existing;
  }
  const created = await TimeTracking.create({ token_id: tokenId });
  return created.toObject();
};

const getTokenOrThrow = async (tokenId = "") => {
  const token = await Token.findOne({ token_id: tokenId });
  if (!token) {
    throw new ApiError("Token not found", 404);
  }
  return token;
};

const updateTracking = async (tokenId = "", payload = {}) => {
  await ensureTrackingRecord(tokenId);
  const updated = await TimeTracking.findOneAndUpdate(
    { token_id: tokenId },
    { $set: payload },
    { new: true }
  ).lean();
  sendDebugLog("H2", "Mongo time_tracking updated", {
    tokenId,
    updatedFields: Object.keys(payload ?? {})
  });
  return updated;
};

const normalizeBillingPayments = (payments = []) =>
  Array.isArray(payments)
    ? payments
        .map((item) => ({
          amount: Number(item?.amount ?? 0),
          paid_at: item?.paid_at ? new Date(item.paid_at) : new Date(),
          note: String(item?.note ?? "").trim(),
          label: String(item?.label ?? "").trim().toLowerCase()
        }))
        .filter((item) => Number.isFinite(item.amount) && item.amount > 0)
    : [];

const sumBillingPayments = (payments = []) =>
  Number(
    normalizeBillingPayments(payments)
      .reduce((sum, item) => sum + item.amount, 0)
      .toFixed(2)
  );

const normalizeWorkflowLogs = (logs = []) =>
  Array.isArray(logs)
    ? logs
        .map((entry) => ({
          start: entry?.start ? new Date(entry.start) : null,
          end: entry?.end ? new Date(entry.end) : null
        }))
        .filter((entry) => entry.start && !Number.isNaN(entry.start.getTime()))
    : [];

const appendWorkflowStart = (logs = [], start = new Date()) => [
  ...normalizeWorkflowLogs(logs),
  { start, end: null }
];

const closeWorkflowLastOpen = (logs = [], end = new Date()) => {
  const normalized = normalizeWorkflowLogs(logs);
  for (let i = normalized.length - 1; i >= 0; i -= 1) {
    if (!normalized[i].end) {
      normalized[i] = { ...normalized[i], end };
      return normalized;
    }
  }
  return normalized;
};

export const createToken = async (input = {}) => {
  const patient_id = String(input?.patient_id ?? "").trim();
  const visit_id = String(input?.visit_id ?? "").trim();
  const patient_name = String(input?.patient_name ?? "").trim();
  const patient_phone = String(input?.patient_phone ?? "").trim();
  const department = String(input?.department ?? "").trim();

  if (!patient_id || !visit_id || !department) {
    throw new ApiError("patient_id, visit_id and department are required", 400);
  }

  const deptOk = await isActiveDepartmentName(department);
  if (!deptOk) {
    throw new ApiError("Invalid or inactive department. Configure departments under admin settings.", 400);
  }

  sendDebugLog("H5", "Create token skips HIS revalidation by design", {
    patient_id,
    visit_id
  });

  const token = await Token.create({
    token_id: generateTokenId(),
    patient_id,
    visit_id,
    patient_name,
    patient_phone,
    department,
    parent_token_id: null,
    status: "WAITING"
  });

  await TimeTracking.create({
    token_id: token.token_id,
    waiting_start: new Date()
  });
  sendDebugLog("H2", "Mongo token created with tracking", {
    tokenId: token.token_id,
    status: token.status
  });

  return token.toObject();
};

export const startConsulting = async (tokenId = "", payload = {}) => {
  const token = await getTokenOrThrow(tokenId);
  if (!["WAITING", "ACTIVE"].includes(token.status)) {
    throw new ApiError("Only waiting tokens can start consultation", 400);
  }
  const selectedDepartment = String(payload?.department ?? "").trim();
  if (!selectedDepartment) {
    throw new ApiError("department is required to start consultation", 400);
  }
  const deptOk = await isActiveDepartmentName(selectedDepartment);
  if (!deptOk) {
    throw new ApiError("Invalid or inactive department. Choose a department from admin settings.", 400);
  }
  const now = new Date();
  const tracking = await updateTracking(tokenId, { consult_start: now });
  token.status = "CONSULTING";
  token.department = selectedDepartment;
  await token.save();
  return { token, tracking, metrics: calculateTimeMetrics(tracking, token.status) };
};

const POST_CONSULT_PLAN_IDS = new Set(["labs", "treatment", "pharmacy", "billing"]);

const normalizePostConsultPlans = (payload = {}) => {
  const raw = payload?.post_consult_plans;
  let plans = [];
  if (Array.isArray(raw)) {
    plans = raw
      .map((p) => String(p).trim())
      .filter((p) => POST_CONSULT_PLAN_IDS.has(p));
  }
  if (plans.length === 0 && payload?.labs_ordered === true) {
    plans = ["labs"];
  }
  return [...new Set(plans)];
};

export const endConsulting = async (tokenId = "", payload = {}) => {
  const token = await getTokenOrThrow(tokenId);
  if (token.status !== "CONSULTING") {
    throw new ApiError("Token is not in consultation", 400);
  }
  const now = new Date();
  const note = String(payload?.consult_note ?? "").trim();
  const nextDepartment = String(payload?.next_department ?? "").trim();
  const plans = normalizePostConsultPlans(payload);
  const labsOrdered = plans.includes("labs");
  const patch = {
    consult_end: now,
    consult_note: note,
    referred_department: nextDepartment,
    labs_ordered: labsOrdered,
    post_consult_plans: plans
  };
  const tracking = await updateTracking(tokenId, patch);
  if (nextDepartment) {
    token.department = nextDepartment;
    await token.save();
  }
  return { token, tracking, metrics: calculateTimeMetrics(tracking, token.status) };
};

/** Patient paid at billing after consult (labs/tests path). */
export const recordBillingPayment = async (tokenId = "", payload = {}) => {
  const token = await getTokenOrThrow(tokenId);
  const tracking = await ensureTrackingRecord(tokenId);
  const amount = Number(payload?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError("A valid payment amount is required", 400);
  }
  const note = String(payload?.note ?? "").trim();
  const label = String(payload?.billing_label ?? "")
    .trim()
    .toLowerCase();
  const allowedLabels = new Set(["", "lab", "pharmacy", "treatment"]);
  if (!allowedLabels.has(label)) {
    throw new ApiError("Invalid billing label. Use lab, pharmacy, or treatment", 400);
  }
  const existingPayments = normalizeBillingPayments(tracking.billing_payments);
  const now = new Date();
  const effectiveBillingStart = tracking.billing_start ? new Date(tracking.billing_start) : now;
  const nextPayments = [...existingPayments, { amount, paid_at: now, note, label }];
  const paidAmount = sumBillingPayments(nextPayments);
  let elapsedMs = Math.max(0, Number(tracking.billing_elapsed_ms ?? 0) || 0);
  const segmentMs = Math.max(now.getTime() - effectiveBillingStart.getTime(), 0);
  elapsedMs += Number.isNaN(segmentMs) ? 0 : segmentMs;
  const patch = {
    billing_start: null,
    billing_end: now,
    billing_elapsed_ms: elapsedMs,
    billing_payments: nextPayments,
    billing_paid_amount: paidAmount
  };
  const next = await updateTracking(tokenId, patch);
  return { token, tracking: next, metrics: calculateTimeMetrics(next, token.status) };
};

/** Flexible mode: billing desk can start billing in any token status. */
export const startBillingPhase = async (tokenId = "") => {
  const token = await getTokenOrThrow(tokenId);
  const tracking = await ensureTrackingRecord(tokenId);
  const existingPayments = normalizeBillingPayments(tracking.billing_payments);
  const paidAmount = sumBillingPayments(existingPayments);
  if (tracking.billing_start && !tracking.billing_end) {
    return { token, tracking, metrics: calculateTimeMetrics(tracking, token.status) };
  }
  const now = new Date();
  const patch = {
    billing_start: now,
    billing_end: null,
    billing_elapsed_ms: Math.max(0, Number(tracking.billing_elapsed_ms ?? 0) || 0),
    billing_payments: existingPayments,
    billing_paid_amount: paidAmount
  };
  const next = await updateTracking(tokenId, patch);
  return { token, tracking: next, metrics: calculateTimeMetrics(next, token.status) };
};

/** Stop billing timer without closing payment lifecycle. */
export const stopBillingPhase = async (tokenId = "") => {
  const token = await getTokenOrThrow(tokenId);
  const tracking = await ensureTrackingRecord(tokenId);
  if (!tracking.billing_start || tracking.billing_end) {
    return { token, tracking, metrics: calculateTimeMetrics(tracking, token.status) };
  }
  const now = Date.now();
  const started = new Date(tracking.billing_start).getTime();
  const segmentMs = Number.isNaN(started) ? 0 : Math.max(now - started, 0);
  const elapsedMs = Math.max(0, Number(tracking.billing_elapsed_ms ?? 0) || 0) + segmentMs;
  const next = await updateTracking(tokenId, { billing_start: null, billing_elapsed_ms: elapsedMs });
  return { token, tracking: next, metrics: calculateTimeMetrics(next, token.status) };
};

/** Explicitly end billing after payments are done. */
export const endBillingPhase = async (tokenId = "") => {
  const token = await getTokenOrThrow(tokenId);
  const tracking = await ensureTrackingRecord(tokenId);
  const hasBillingStarted =
    Boolean(tracking.billing_start) ||
    (Number(tracking.billing_elapsed_ms ?? 0) || 0) > 0 ||
    normalizeBillingPayments(tracking.billing_payments).length > 0;
  if (!hasBillingStarted) {
    throw new ApiError("Start billing before ending it", 400);
  }
  if (tracking.billing_end) {
    return { token, tracking, metrics: calculateTimeMetrics(tracking, token.status) };
  }
  const now = new Date();
  let elapsedMs = Math.max(0, Number(tracking.billing_elapsed_ms ?? 0) || 0);
  if (tracking.billing_start) {
    const segmentMs = Math.max(now.getTime() - new Date(tracking.billing_start).getTime(), 0);
    elapsedMs += Number.isNaN(segmentMs) ? 0 : segmentMs;
  }
  const next = await updateTracking(tokenId, {
    billing_start: null,
    billing_end: now,
    billing_elapsed_ms: elapsedMs
  });
  return { token, tracking: next, metrics: calculateTimeMetrics(next, token.status) };
};

/** Flexible mode: pharmacy desk can start/stop until explicitly ended. */
export const startPharmacyPhase = async (tokenId = "") => {
  const token = await getTokenOrThrow(tokenId);
  if (token.status !== "CONSULTING") {
    throw new ApiError("Pharmacy can only run during consultation follow-up", 400);
  }
  const tracking = await ensureTrackingRecord(tokenId);
  if (!tracking.consult_end) {
    throw new ApiError("End consultation before starting pharmacy", 400);
  }
  if (tracking.pharmacy_start) {
    return { token, tracking, metrics: calculateTimeMetrics(tracking, token.status) };
  }
  const now = new Date();
  const billingPatch = {};
  if (!tracking.billing_start || tracking.billing_end) {
    const existingPayments = normalizeBillingPayments(tracking.billing_payments);
    const paidAmount = sumBillingPayments(existingPayments);
    billingPatch.billing_start = now;
    billingPatch.billing_end = null;
    billingPatch.billing_elapsed_ms = Math.max(0, Number(tracking.billing_elapsed_ms ?? 0) || 0);
    billingPatch.billing_payments = existingPayments;
    billingPatch.billing_paid_amount = paidAmount;
  }
  const next = await updateTracking(tokenId, {
    pharmacy_start: now,
    pharmacy_end: null,
    pharmacy_logs: appendWorkflowStart(tracking.pharmacy_logs, now),
    pharmacy_elapsed_ms: Math.max(0, Number(tracking.pharmacy_elapsed_ms ?? 0) || 0),
    ...billingPatch
  });
  return { token, tracking: next, metrics: calculateTimeMetrics(next, token.status) };
};

export const stopPharmacyPhase = async (tokenId = "") => {
  const token = await getTokenOrThrow(tokenId);
  const tracking = await ensureTrackingRecord(tokenId);
  if (!tracking.pharmacy_start || tracking.pharmacy_end) {
    return { token, tracking, metrics: calculateTimeMetrics(tracking, token.status) };
  }
  const now = Date.now();
  const started = new Date(tracking.pharmacy_start).getTime();
  const segmentMs = Number.isNaN(started) ? 0 : Math.max(now - started, 0);
  const elapsedMs = Math.max(0, Number(tracking.pharmacy_elapsed_ms ?? 0) || 0) + segmentMs;
  const next = await updateTracking(tokenId, { pharmacy_start: null, pharmacy_elapsed_ms: elapsedMs });
  return { token, tracking: next, metrics: calculateTimeMetrics(next, token.status) };
};

export const endPharmacyPhase = async (tokenId = "") => {
  const token = await getTokenOrThrow(tokenId);
  const tracking = await ensureTrackingRecord(tokenId);
  const hasPharmacyStarted =
    Boolean(tracking.pharmacy_start) || (Number(tracking.pharmacy_elapsed_ms ?? 0) || 0) > 0;
  if (!hasPharmacyStarted) {
    throw new ApiError("Start pharmacy before ending it", 400);
  }
  if (tracking.pharmacy_end && !tracking.pharmacy_start) {
    return { token, tracking, metrics: calculateTimeMetrics(tracking, token.status) };
  }
  const now = new Date();
  let elapsedMs = Math.max(0, Number(tracking.pharmacy_elapsed_ms ?? 0) || 0);
  if (tracking.pharmacy_start) {
    const segmentMs = Math.max(now.getTime() - new Date(tracking.pharmacy_start).getTime(), 0);
    elapsedMs += Number.isNaN(segmentMs) ? 0 : segmentMs;
  }
  const next = await updateTracking(tokenId, {
    pharmacy_start: null,
    pharmacy_end: now,
    pharmacy_logs: closeWorkflowLastOpen(tracking.pharmacy_logs, now),
    pharmacy_elapsed_ms: elapsedMs,
    ...(tracking.billing_start
      ? {
          billing_start: null,
          billing_end: now,
          billing_elapsed_ms:
            Math.max(0, Number(tracking.billing_elapsed_ms ?? 0) || 0) +
            Math.max(now.getTime() - new Date(tracking.billing_start).getTime(), 0)
        }
      : {})
  });
  return { token, tracking: next, metrics: calculateTimeMetrics(next, token.status) };
};

/**
 * Add lab workflow after consult (e.g. patient did pharmacy first, then needs tests).
 * Idempotent if labs are already ordered.
 */
export const orderLabsAfterConsult = async (tokenId = "") => {
  const token = await getTokenOrThrow(tokenId);
  if (token.status !== "CONSULTING") {
    throw new ApiError("Token is not in consultation", 400);
  }
  const tracking = await ensureTrackingRecord(tokenId);
  if (!tracking.consult_end) {
    throw new ApiError("End consultation first", 400);
  }
  if (tracking.lab_end) {
    throw new ApiError("Lab path is already completed for this visit", 400);
  }
  if (tracking.labs_ordered) {
    return { token, tracking, metrics: calculateTimeMetrics(tracking, token.status) };
  }
  const now = new Date();
  const existing = Array.isArray(tracking.post_consult_plans) ? tracking.post_consult_plans : [];
  const cleaned = existing.map(String).filter((p) => POST_CONSULT_PLAN_IDS.has(p));
  const plans = [...new Set([...cleaned, "labs"])];
  const needsBillingDesk =
    plans.includes("labs") || plans.includes("pharmacy") || plans.includes("billing");
  const patch = {
    labs_ordered: true,
    post_consult_plans: plans
  };
  if (needsBillingDesk) {
    if (!tracking.billing_end) {
      if (!tracking.billing_start) {
        patch.billing_start = now;
        patch.billing_elapsed_ms = 0;
      }
    } else {
      const existingPayments = normalizeBillingPayments(tracking.billing_payments);
      const paidAmount = sumBillingPayments(existingPayments);
      patch.billing_start = now;
      patch.billing_end = null;
      patch.billing_elapsed_ms = Math.max(0, Number(tracking.billing_elapsed_ms ?? 0) || 0);
      patch.billing_payments = existingPayments;
      patch.billing_paid_amount = paidAmount;
    }
  }
  const next = await updateTracking(tokenId, patch);
  return { token, tracking: next, metrics: calculateTimeMetrics(next, token.status) };
};

/** Lab work begins (clinical path; billing is tracked separately). */
export const startLabTesting = async (tokenId = "") => {
  const token = await getTokenOrThrow(tokenId);
  if (token.status !== "CONSULTING") {
    throw new ApiError("Lab can only start during consultation follow-up", 400);
  }
  const tracking = await ensureTrackingRecord(tokenId);
  if (!tracking.consult_end) {
    throw new ApiError("End consultation before starting lab testing", 400);
  }
  if (tracking.lab_start && !tracking.lab_end) {
    throw new ApiError("Lab testing has already started", 400);
  }
  const now = new Date();
  const billingPatch = {};
  if (!tracking.billing_start || tracking.billing_end) {
    const existingPayments = normalizeBillingPayments(tracking.billing_payments);
    const paidAmount = sumBillingPayments(existingPayments);
    billingPatch.billing_start = now;
    billingPatch.billing_end = null;
    billingPatch.billing_elapsed_ms = Math.max(0, Number(tracking.billing_elapsed_ms ?? 0) || 0);
    billingPatch.billing_payments = existingPayments;
    billingPatch.billing_paid_amount = paidAmount;
  }
  const next = await updateTracking(tokenId, {
    lab_start: now,
    lab_end: null,
    labs_ordered: true,
    lab_logs: appendWorkflowStart(tracking.lab_logs, now),
    ...billingPatch
  });
  return { token, tracking: next, metrics: calculateTimeMetrics(next, token.status) };
};

export const endLabTesting = async (tokenId = "") => {
  const token = await getTokenOrThrow(tokenId);
  if (token.status === "COMPLETED") {
    throw new ApiError("Cannot complete lab after visit is completed", 400);
  }
  const tracking = await ensureTrackingRecord(tokenId);
  if (!tracking.lab_start) {
    throw new ApiError("Lab testing has not started", 400);
  }
  if (tracking.lab_end && !tracking.lab_start) {
    throw new ApiError("Lab testing has already ended", 400);
  }
  const now = new Date();
  const next = await updateTracking(tokenId, {
    lab_end: now,
    lab_logs: closeWorkflowLastOpen(tracking.lab_logs, now)
  });
  return { token, tracking: next, metrics: calculateTimeMetrics(next, token.status) };
};

export const startTreatment = async (tokenId = "") => {
  const token = await getTokenOrThrow(tokenId);
  const tracking = await ensureTrackingRecord(tokenId);
  if (token.status === "COMPLETED") {
    throw new ApiError("Completed visit cannot start treatment", 400);
  }
  if (token.status === "IN_TREATMENT") {
    throw new ApiError("Treatment has already started", 400);
  }
  const now = new Date();
  const billingPatch = {};
  if (!tracking.billing_start || tracking.billing_end) {
    const existingPayments = normalizeBillingPayments(tracking.billing_payments);
    const paidAmount = sumBillingPayments(existingPayments);
    billingPatch.billing_start = now;
    billingPatch.billing_end = null;
    billingPatch.billing_elapsed_ms = Math.max(0, Number(tracking.billing_elapsed_ms ?? 0) || 0);
    billingPatch.billing_payments = existingPayments;
    billingPatch.billing_paid_amount = paidAmount;
  }
  const nextTracking = await updateTracking(tokenId, {
    care_start: now,
    care_end: null,
    treatment_logs: appendWorkflowStart(tracking.treatment_logs, now),
    ...billingPatch
  });
  token.status = "IN_TREATMENT";
  await token.save();
  return { token, tracking: nextTracking, metrics: calculateTimeMetrics(nextTracking, token.status) };
};

export const moveTokenToWaiting = async (tokenId = "") => {
  const token = await getTokenOrThrow(tokenId);
  const now = new Date();
  const tracking = await updateTracking(tokenId, {
    waiting_start: now,
    consult_start: null,
    consult_end: null,
    labs_ordered: false,
    post_consult_plans: [],
    care_start: null,
    care_end: null,
    billing_start: null,
    billing_end: null,
    billing_elapsed_ms: 0,
    billing_total_amount: 0,
    billing_paid_amount: 0,
    billing_payments: [],
    lab_start: null,
    lab_end: null,
    lab_logs: [],
    pharmacy_start: null,
    pharmacy_end: null,
    pharmacy_elapsed_ms: 0,
    pharmacy_logs: [],
    treatment_logs: []
  });
  token.status = "WAITING";
  await token.save();
  return { token, tracking, metrics: calculateTimeMetrics(tracking, token.status) };
};

/**
 * Reverts one step in the workflow (reverse of forward progress):
 * treatment start → consult ended → consult started → waiting
 */
export const stepBackToken = async (tokenId = "") => {
  const token = await getTokenOrThrow(tokenId);
  const tracking = await ensureTrackingRecord(tokenId);

  if (token.status === "IN_TREATMENT") {
    if (!tracking.care_start) {
      throw new ApiError("Cannot step back: treatment not started", 400);
    }
    await updateTracking(tokenId, { care_start: null, care_end: null });
    token.status = tracking.consult_start ? "CONSULTING" : "WAITING";
    await token.save();
    const next = await ensureTrackingRecord(tokenId);
    return { token, tracking: next, metrics: calculateTimeMetrics(next, token.status) };
  }

  if (token.status === "CONSULTING" && tracking.consult_end) {
    await updateTracking(tokenId, {
      consult_end: null,
      consult_note: "",
      referred_department: "",
      labs_ordered: false,
      post_consult_plans: [],
      lab_start: null,
      lab_end: null
    });
    const next = await ensureTrackingRecord(tokenId);
    return { token, tracking: next, metrics: calculateTimeMetrics(next, token.status) };
  }

  if (token.status === "CONSULTING" && tracking.consult_start) {
    await updateTracking(tokenId, { consult_start: null });
    token.status = "WAITING";
    await token.save();
    const next = await ensureTrackingRecord(tokenId);
    return { token, tracking: next, metrics: calculateTimeMetrics(next, token.status) };
  }

  throw new ApiError("Already at the earliest step (waiting).", 400);
};

/**
 * Reverts workflow to a named earlier milestone (clears tracking after that point).
 */
export const revertTokenToAnchor = async (tokenId = "", anchor = "") => {
  const token = await getTokenOrThrow(tokenId);
  const tracking = await ensureTrackingRecord(tokenId);
  const trimmed = String(anchor ?? "").trim();
  const currentStage = detectVisitStage(tracking, token.status);
  assertRevertAllowed(currentStage, trimmed);
  const patch = buildRevertPatchForAnchor(trimmed);
  if (!patch) {
    throw new ApiError("Invalid revert anchor", 400);
  }
  const nextTracking = await updateTracking(tokenId, patch);
  token.status = resolveStatusAfterRevert(nextTracking);
  await token.save();
  const finalTracking = await ensureTrackingRecord(tokenId);
  return { token, tracking: finalTracking, metrics: calculateTimeMetrics(finalTracking, token.status) };
};

export const endTreatment = async (tokenId = "") => {
  const token = await getTokenOrThrow(tokenId);
  if (token.status !== "IN_TREATMENT") {
    throw new ApiError("Token is not in treatment", 400);
  }
  const now = new Date();
  const current = await ensureTrackingRecord(tokenId);
  const tracking = await updateTracking(tokenId, {
    care_start: null,
    care_end: now,
    treatment_logs: closeWorkflowLastOpen(current.treatment_logs, now)
  });
  token.status = "CONSULTING";
  await token.save();
  return { token, tracking, metrics: calculateTimeMetrics(tracking, token.status) };
};

export const completeVisitAfterConsult = async (tokenId = "") => {
  const token = await getTokenOrThrow(tokenId);
  const tracking = await ensureTrackingRecord(tokenId);
  if (token.status === "COMPLETED") {
    return { token, tracking, metrics: calculateTimeMetrics(tracking, token.status) };
  }
  const now = new Date();
  const patch = {};
  if (tracking.consult_start && !tracking.consult_end) {
    patch.consult_end = now;
  }
  if (tracking.lab_start && !tracking.lab_end) {
    patch.lab_end = now;
    patch.lab_logs = closeWorkflowLastOpen(tracking.lab_logs, now);
  }
  if (tracking.pharmacy_start) {
    const elapsedMs =
      Math.max(0, Number(tracking.pharmacy_elapsed_ms ?? 0) || 0) +
      Math.max(now.getTime() - new Date(tracking.pharmacy_start).getTime(), 0);
    patch.pharmacy_start = null;
    patch.pharmacy_end = now;
    patch.pharmacy_elapsed_ms = elapsedMs;
    patch.pharmacy_logs = closeWorkflowLastOpen(tracking.pharmacy_logs, now);
  }
  if (tracking.billing_start) {
    const elapsedMs =
      Math.max(0, Number(tracking.billing_elapsed_ms ?? 0) || 0) +
      Math.max(now.getTime() - new Date(tracking.billing_start).getTime(), 0);
    patch.billing_start = null;
    patch.billing_end = now;
    patch.billing_elapsed_ms = elapsedMs;
  }
  if (tracking.care_start && !tracking.care_end) {
    patch.care_end = now;
    patch.treatment_logs = closeWorkflowLastOpen(tracking.treatment_logs, now);
  }
  const next = Object.keys(patch).length ? await updateTracking(tokenId, patch) : tracking;
  token.status = "COMPLETED";
  await token.save();
  return { token, tracking: next, metrics: calculateTimeMetrics(next, token.status) };
};

export const branchToken = async (tokenId = "", newDepartment = "") => {
  const currentToken = await getTokenOrThrow(tokenId);
  if (!newDepartment) {
    throw new ApiError("new_department is required", 400);
  }
  const branchDeptOk = await isActiveDepartmentName(newDepartment);
  if (!branchDeptOk) {
    throw new ApiError("Invalid or inactive department for branch", 400);
  }

  const now = new Date();
  await updateTracking(currentToken.token_id, { break_start: now });

  const branchedToken = await Token.create({
    token_id: generateTokenId(),
    patient_id: currentToken.patient_id,
    visit_id: currentToken.visit_id,
    patient_name: currentToken.patient_name ?? "",
    patient_phone: currentToken.patient_phone ?? "",
    department: newDepartment,
    parent_token_id: currentToken.token_id,
    status: "WAITING"
  });

  await TimeTracking.create({
    token_id: branchedToken.token_id,
    break_end: now,
    waiting_start: now
  });

  await DepartmentFlow.create({
    source_token_id: currentToken.token_id,
    destination_token_id: branchedToken.token_id,
    from_department: currentToken.department,
    to_department: newDepartment
  });

  return branchedToken.toObject();
};

const patientIdsMissingStoredName = (tokens = []) =>
  [
    ...new Set(
      tokens
        .filter((t) => !String(t?.patient_name ?? "").trim())
        .map((t) => String(t?.patient_id ?? "").trim())
        .filter(Boolean)
    )
  ];

const loadDemographicsByPatientId = async (tokens = []) => {
  const ids = patientIdsMissingStoredName(tokens);
  if (!ids.length) {
    return {};
  }
  return fetchPatientDemographics(ids);
};

const displayPatientName = (token = {}, demoByPatientId = {}) => {
  const stored = String(token?.patient_name ?? "").trim();
  if (stored) {
    return stored;
  }
  const pid = String(token?.patient_id ?? "").trim();
  const fromHis = pid ? String(demoByPatientId[pid]?.name ?? "").trim() : "";
  if (fromHis) {
    return fromHis;
  }
  return `Patient ${token.patient_id}`;
};

const displayPatientPhone = (token = {}, demoByPatientId = {}) => {
  const stored = String(token?.patient_phone ?? "").trim();
  if (stored) {
    return stored;
  }
  const pid = String(token?.patient_id ?? "").trim();
  return pid ? String(demoByPatientId[pid]?.phone ?? "").trim() : "";
};

const matchesLiveSearch = (row = {}, search = "") => {
  const q = String(search ?? "").toLowerCase().trim();
  if (!q) {
    return true;
  }
  const parts = [
    row.token_id,
    row.patient_id,
    row.visit_id,
    row.name,
    row.phone
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return parts.some((value) => value.includes(q));
};

export const getLiveQueue = async (filters = {}) => {
  const search = String(filters?.search ?? "");
  const departmentFilter = String(filters?.department ?? "").trim();

  const activeTokens = await Token.find({ status: { $ne: "COMPLETED" } })
    .sort({ created_at: -1 })
    .lean();

  const demoByPatientId = await loadDemographicsByPatientId(activeTokens);

  const tokenIds = activeTokens.map((token) => token.token_id);
  const trackingRows = await TimeTracking.find({ token_id: { $in: tokenIds } }).lean();
  sendDebugLog("H3", "Live queue data sources resolved", {
    tokenCount: activeTokens.length,
    trackingCount: trackingRows.length,
    hisDemographicsPatients: Object.keys(demoByPatientId ?? {}).length
  });
  const trackingByToken = trackingRows.reduce((acc, row) => {
    acc[row.token_id] = row;
    return acc;
  }, {});

  return activeTokens
    .map((token) => {
      const tracking = trackingByToken[token.token_id] ?? {};
      const normalizedStatus = token.status === "ACTIVE" ? "WAITING" : token.status;
      return {
        token_id: token.token_id,
        patient_id: token.patient_id,
        visit_id: token.visit_id,
        name: displayPatientName(token, demoByPatientId),
        phone: displayPatientPhone(token, demoByPatientId),
        department: token.department,
        status: normalizedStatus,
        waiting_start: tracking.waiting_start ?? null,
        consult_start: tracking.consult_start ?? null,
        consult_end: tracking.consult_end ?? null,
        treatment_start: tracking.care_start ?? null,
        treatment_end: tracking.care_end ?? null,
        billing_start: tracking.billing_start ?? null,
        billing_end: tracking.billing_end ?? null,
        pharmacy_start: tracking.pharmacy_start ?? null,
        pharmacy_end: tracking.pharmacy_end ?? null,
        labs_ordered: Boolean(tracking.labs_ordered),
        post_consult_plans: Array.isArray(tracking.post_consult_plans)
          ? tracking.post_consult_plans
          : [],
        lab_start: tracking.lab_start ?? null,
        lab_end: tracking.lab_end ?? null,
        created_at: token.created_at,
        ...buildTatMetrics(tracking, normalizedStatus)
      };
    })
    .filter((row) => {
      if (departmentFilter && row.department !== departmentFilter) {
        return false;
      }
      return matchesLiveSearch(row, search);
    });
};

export const getCompletedTokens = async (filters = {}) => {
  const search = String(filters?.search ?? "");
  const completedTokens = await Token.find({ status: "COMPLETED" })
    .sort({ updated_at: -1, created_at: -1 })
    .lean();

  const demoByPatientId = await loadDemographicsByPatientId(completedTokens);

  const tokenIds = completedTokens.map((token) => token.token_id);
  const trackingRows = await TimeTracking.find({ token_id: { $in: tokenIds } }).lean();
  const trackingByToken = trackingRows.reduce((acc, row) => {
    acc[row.token_id] = row;
    return acc;
  }, {});

  return completedTokens
    .map((token) => {
      const tracking = trackingByToken[token.token_id] ?? {};
      return {
        token_id: token.token_id,
        patient_id: token.patient_id,
        visit_id: token.visit_id,
        name: displayPatientName(token, demoByPatientId),
        phone: displayPatientPhone(token, demoByPatientId),
        department: token.department,
        status: token.status,
        waiting_start: tracking.waiting_start ?? null,
        consult_start: tracking.consult_start ?? null,
        consult_end: tracking.consult_end ?? null,
        treatment_start: tracking.care_start ?? null,
        treatment_end: tracking.care_end ?? null,
        billing_start: tracking.billing_start ?? null,
        billing_end: tracking.billing_end ?? null,
        pharmacy_start: tracking.pharmacy_start ?? null,
        pharmacy_end: tracking.pharmacy_end ?? null,
        labs_ordered: Boolean(tracking.labs_ordered),
        post_consult_plans: Array.isArray(tracking.post_consult_plans)
          ? tracking.post_consult_plans
          : [],
        lab_start: tracking.lab_start ?? null,
        lab_end: tracking.lab_end ?? null,
        created_at: token.created_at,
        ...buildTatMetrics(tracking, token.status)
      };
    })
    .filter((row) => matchesLiveSearch(row, search));
};

export const getTokenDetail = async (tokenId = "") => {
  const token = await getTokenOrThrow(tokenId);
  const tracking = await ensureTrackingRecord(token.token_id);
  const demoByPatientId = await loadDemographicsByPatientId([token]);
  const patient = {
    name: displayPatientName(token, demoByPatientId),
    phone: displayPatientPhone(token, demoByPatientId)
  };
  return {
    token,
    patient,
    tracking,
    metrics: calculateTimeMetrics(tracking, token.status)
  };
};
