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
  return { token, tracking, metrics: calculateTimeMetrics(tracking) };
};

export const endConsulting = async (tokenId = "", payload = {}) => {
  const token = await getTokenOrThrow(tokenId);
  if (token.status !== "CONSULTING") {
    throw new ApiError("Token is not in consultation", 400);
  }
  const now = new Date();
  const note = String(payload?.consult_note ?? "").trim();
  const nextDepartment = String(payload?.next_department ?? "").trim();
  const labsOrdered = Boolean(payload?.labs_ordered);
  const patch = {
    consult_end: now,
    consult_note: note,
    referred_department: nextDepartment
  };
  if (labsOrdered) {
    patch.billing_start = now;
  }
  const tracking = await updateTracking(tokenId, patch);
  if (nextDepartment) {
    token.department = nextDepartment;
    await token.save();
  }
  return { token, tracking, metrics: calculateTimeMetrics(tracking) };
};

/** Patient paid at billing after consult (labs/tests path). */
export const recordBillingPayment = async (tokenId = "") => {
  const token = await getTokenOrThrow(tokenId);
  if (token.status !== "CONSULTING") {
    throw new ApiError("Payment can only be recorded during consultation follow-up", 400);
  }
  const tracking = await ensureTrackingRecord(tokenId);
  if (!tracking.billing_start) {
    throw new ApiError("No billing phase is active for this token", 400);
  }
  if (tracking.billing_end) {
    throw new ApiError("Payment has already been recorded", 400);
  }
  const now = new Date();
  const next = await updateTracking(tokenId, { billing_end: now });
  return { token, tracking: next, metrics: calculateTimeMetrics(next) };
};

/** Lab work begins (after billing / queue). */
export const startLabTesting = async (tokenId = "") => {
  const token = await getTokenOrThrow(tokenId);
  if (token.status !== "CONSULTING") {
    throw new ApiError("Lab can only start during consultation follow-up", 400);
  }
  const tracking = await ensureTrackingRecord(tokenId);
  if (!tracking.billing_start) {
    throw new ApiError("Labs were not ordered for this visit", 400);
  }
  if (!tracking.billing_end) {
    throw new ApiError("Record payment before starting lab testing", 400);
  }
  if (tracking.lab_start) {
    throw new ApiError("Lab testing has already started", 400);
  }
  const now = new Date();
  const next = await updateTracking(tokenId, { lab_start: now });
  return { token, tracking: next, metrics: calculateTimeMetrics(next) };
};

export const endLabTesting = async (tokenId = "") => {
  const token = await getTokenOrThrow(tokenId);
  if (token.status !== "CONSULTING") {
    throw new ApiError("Lab can only be completed during consultation follow-up", 400);
  }
  const tracking = await ensureTrackingRecord(tokenId);
  if (!tracking.lab_start) {
    throw new ApiError("Lab testing has not started", 400);
  }
  if (tracking.lab_end) {
    throw new ApiError("Lab testing has already ended", 400);
  }
  const now = new Date();
  const next = await updateTracking(tokenId, { lab_end: now });
  return { token, tracking: next, metrics: calculateTimeMetrics(next) };
};

export const startTreatment = async (tokenId = "") => {
  const token = await getTokenOrThrow(tokenId);
  const tracking = await ensureTrackingRecord(tokenId);
  if (token.status !== "CONSULTING") {
    throw new ApiError("Start treatment is only available when the token is in consultation", 400);
  }
  if (!tracking.consult_end) {
    throw new ApiError("End consultation before starting treatment", 400);
  }
  if (tracking.billing_start && !tracking.lab_end) {
    throw new ApiError("Finish billing and lab testing before starting treatment", 400);
  }
  const now = new Date();
  const nextTracking = await updateTracking(tokenId, { care_start: now });
  token.status = "IN_TREATMENT";
  await token.save();
  return { token, tracking: nextTracking, metrics: calculateTimeMetrics(nextTracking) };
};

export const moveTokenToWaiting = async (tokenId = "") => {
  const token = await getTokenOrThrow(tokenId);
  const now = new Date();
  const tracking = await updateTracking(tokenId, {
    waiting_start: now,
    consult_start: null,
    consult_end: null,
    care_start: null,
    care_end: null,
    billing_start: null,
    billing_end: null,
    lab_start: null,
    lab_end: null
  });
  token.status = "WAITING";
  await token.save();
  return { token, tracking, metrics: calculateTimeMetrics(tracking) };
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
    return { token, tracking: next, metrics: calculateTimeMetrics(next) };
  }

  if (token.status === "CONSULTING" && tracking.consult_end) {
    await updateTracking(tokenId, {
      consult_end: null,
      consult_note: "",
      referred_department: "",
      billing_start: null,
      billing_end: null,
      lab_start: null,
      lab_end: null
    });
    const next = await ensureTrackingRecord(tokenId);
    return { token, tracking: next, metrics: calculateTimeMetrics(next) };
  }

  if (token.status === "CONSULTING" && tracking.consult_start) {
    await updateTracking(tokenId, { consult_start: null });
    token.status = "WAITING";
    await token.save();
    const next = await ensureTrackingRecord(tokenId);
    return { token, tracking: next, metrics: calculateTimeMetrics(next) };
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
  return { token, tracking: finalTracking, metrics: calculateTimeMetrics(finalTracking) };
};

export const endTreatment = async (tokenId = "") => {
  const token = await getTokenOrThrow(tokenId);
  if (token.status !== "IN_TREATMENT") {
    throw new ApiError("Token is not in treatment", 400);
  }
  const now = new Date();
  const tracking = await updateTracking(tokenId, { care_end: now });
  token.status = "COMPLETED";
  await token.save();
  return { token, tracking, metrics: calculateTimeMetrics(tracking) };
};

/**
 * Mark visit complete when only consultation was needed (no treatment phase).
 * Requires consultation ended and treatment never started.
 */
export const completeVisitAfterConsult = async (tokenId = "") => {
  const token = await getTokenOrThrow(tokenId);
  const tracking = await ensureTrackingRecord(tokenId);
  if (token.status !== "CONSULTING") {
    throw new ApiError("Visit can only be completed from consultation when no treatment has started", 400);
  }
  if (!tracking.consult_end) {
    throw new ApiError("End consultation before completing the visit", 400);
  }
  if (tracking.care_start) {
    throw new ApiError("Treatment has already started; end treatment to complete", 400);
  }
  if (tracking.billing_start && !tracking.lab_end) {
    throw new ApiError("Complete billing and lab testing before finishing the visit", 400);
  }
  token.status = "COMPLETED";
  await token.save();
  const next = await ensureTrackingRecord(tokenId);
  return { token, tracking: next, metrics: calculateTimeMetrics(next) };
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

  const tokenIds = activeTokens.map((token) => token.token_id);
  const trackingRows = await TimeTracking.find({ token_id: { $in: tokenIds } }).lean();
  sendDebugLog("H3", "Live queue data sources resolved (mongo-only)", {
    tokenCount: activeTokens.length,
    trackingCount: trackingRows.length,
    hasSqlDemographicsFetch: false
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
        name: token.patient_name || `Patient ${token.patient_id}`,
        phone: token.patient_phone || "",
        department: token.department,
        status: normalizedStatus,
        waiting_start: tracking.waiting_start ?? null,
        consult_start: tracking.consult_start ?? null,
        consult_end: tracking.consult_end ?? null,
        treatment_start: tracking.care_start ?? null,
        treatment_end: tracking.care_end ?? null,
        billing_start: tracking.billing_start ?? null,
        billing_end: tracking.billing_end ?? null,
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
        name: token.patient_name || `Patient ${token.patient_id}`,
        phone: token.patient_phone || "",
        department: token.department,
        status: token.status,
        waiting_start: tracking.waiting_start ?? null,
        consult_start: tracking.consult_start ?? null,
        consult_end: tracking.consult_end ?? null,
        treatment_start: tracking.care_start ?? null,
        treatment_end: tracking.care_end ?? null,
        billing_start: tracking.billing_start ?? null,
        billing_end: tracking.billing_end ?? null,
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
  const patient = {
    name: token.patient_name || `Patient ${token.patient_id}`,
    phone: token.patient_phone || ""
  };
  return {
    token,
    patient,
    tracking,
    metrics: calculateTimeMetrics(tracking)
  };
};
