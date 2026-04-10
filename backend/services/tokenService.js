import { Token } from "../models/Token.js";
import { TimeTracking } from "../models/TimeTracking.js";
import { DepartmentFlow } from "../models/DepartmentFlow.js";
import { ApiError } from "../utils/apiError.js";
import { calculateTimeMetrics } from "../utils/timeMetrics.js";
import { generateTokenId } from "../utils/tokenId.js";
import { checkPatientExistsInHis, fetchPatientDemographics } from "./hisService.js";
import { buildTatMetrics } from "./dashboardService.js";
import { isActiveDepartmentName } from "./departmentService.js";

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
  return TimeTracking.findOneAndUpdate(
    { token_id: tokenId },
    { $set: payload },
    { new: true }
  ).lean();
};

export const createToken = async (input = {}) => {
  const patient_id = String(input?.patient_id ?? "").trim();
  const visit_id = String(input?.visit_id ?? "").trim();
  const department = String(input?.department ?? "").trim();

  if (!patient_id || !visit_id || !department) {
    throw new ApiError("patient_id, visit_id and department are required", 400);
  }

  const deptOk = await isActiveDepartmentName(department);
  if (!deptOk) {
    throw new ApiError("Invalid or inactive department. Configure departments under admin settings.", 400);
  }

  const isValidPatient = await checkPatientExistsInHis(patient_id, visit_id);
  if (!isValidPatient) {
    throw new ApiError("Patient visit not found in HIS", 400);
  }

  const token = await Token.create({
    token_id: generateTokenId(),
    patient_id,
    visit_id,
    department,
    parent_token_id: null,
    status: "WAITING"
  });

  await TimeTracking.create({
    token_id: token.token_id,
    waiting_start: new Date()
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
  const tracking = await updateTracking(tokenId, {
    consult_end: now,
    consult_note: note,
    referred_department: nextDepartment
  });
  if (nextDepartment) {
    token.department = nextDepartment;
    await token.save();
  }
  return { token, tracking, metrics: calculateTimeMetrics(tracking) };
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
    care_end: null
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
      referred_department: ""
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
  const patientIds = activeTokens.map((token) => token.patient_id);
  const [trackingRows, patientMap] = await Promise.all([
    TimeTracking.find({ token_id: { $in: tokenIds } }).lean(),
    fetchPatientDemographics(patientIds)
  ]);
  const trackingByToken = trackingRows.reduce((acc, row) => {
    acc[row.token_id] = row;
    return acc;
  }, {});

  return activeTokens
    .map((token) => {
      const tracking = trackingByToken[token.token_id] ?? {};
      const patientInfo = patientMap[token.patient_id] ?? { name: "Unknown", phone: "" };
      const normalizedStatus = token.status === "ACTIVE" ? "WAITING" : token.status;
      return {
        token_id: token.token_id,
        patient_id: token.patient_id,
        visit_id: token.visit_id,
        name: patientInfo.name,
        phone: patientInfo.phone ?? "",
        department: token.department,
        status: normalizedStatus,
        consult_start: tracking.consult_start ?? null,
        consult_end: tracking.consult_end ?? null,
        treatment_start: tracking.care_start ?? null,
        treatment_end: tracking.care_end ?? null,
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

export const getTokenDetail = async (tokenId = "") => {
  const token = await getTokenOrThrow(tokenId);
  const tracking = await ensureTrackingRecord(token.token_id);
  const patientMap = await fetchPatientDemographics([token.patient_id]);
  const patient = patientMap[token.patient_id] ?? { name: `Patient ${token.patient_id}`, phone: "" };
  return {
    token,
    patient,
    tracking,
    metrics: calculateTimeMetrics(tracking)
  };
};
