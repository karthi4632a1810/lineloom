import { ApiError } from "../utils/apiError.js";

/** Deeper visit stages have higher order (further along). */
export const VISIT_STAGE_ORDER = {
  waiting: 0,
  consult_open: 1,
  consult_closed: 2,
  lab: 3,
  lab_done: 4,
  treatment: 5
};

const NOTE_CLEAR = { consult_note: "", referred_department: "" };

/**
 * Detect coarse visit stage from tracking + token status.
 */
export const detectVisitStage = (tracking = {}, status = "") => {
  const s = String(status ?? "");
  if (s === "COMPLETED") {
    return "completed";
  }
  if (s === "WAITING") {
    return "waiting";
  }
  if (s === "IN_TREATMENT") {
    return "treatment";
  }
  if (s !== "CONSULTING") {
    return "waiting";
  }
  if (tracking.care_start) {
    return "treatment";
  }
  if (tracking.lab_end) {
    return "lab_done";
  }
  if (tracking.lab_start) {
    return "lab";
  }
  if (tracking.consult_end) {
    return "consult_closed";
  }
  if (tracking.consult_start) {
    return "consult_open";
  }
  return "waiting";
};

/**
 * Patch fields to clear so the visit is positioned at the chosen anchor (everything after anchor is nulled).
 */
export const buildRevertPatchForAnchor = (anchor = "") => {
  const a = String(anchor ?? "").trim();
  const base = { ...NOTE_CLEAR };
  switch (a) {
    case "waiting":
      return {
        ...base,
        consult_start: null,
        consult_end: null,
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
        care_start: null,
        care_end: null
      };
    case "consult_open":
      return {
        ...base,
        consult_end: null,
        labs_ordered: false,
        post_consult_plans: [],
        lab_start: null,
        lab_end: null,
        care_start: null,
        care_end: null
      };
    case "consult_closed":
      return {
        ...base,
        lab_start: null,
        lab_end: null,
        care_start: null,
        care_end: null
      };
    case "lab":
      return {
        ...base,
        lab_end: null,
        care_start: null,
        care_end: null
      };
    case "lab_done":
      return {
        ...base,
        care_start: null,
        care_end: null
      };
    default:
      return null;
  }
};

export const resolveStatusAfterRevert = (tracking = {}) => {
  if (!tracking.consult_start) {
    return "WAITING";
  }
  if (tracking.care_start) {
    return "IN_TREATMENT";
  }
  return "CONSULTING";
};

export const assertRevertAllowed = (currentStage = "", anchor = "") => {
  if (currentStage === "completed") {
    throw new ApiError("Cannot revert a completed visit", 400);
  }
  if (currentStage === "waiting") {
    throw new ApiError("Already at the earliest stage", 400);
  }
  const targetOrder = VISIT_STAGE_ORDER[anchor];
  const curOrder = VISIT_STAGE_ORDER[currentStage];
  if (targetOrder == null || curOrder == null) {
    throw new ApiError("Invalid revert target", 400);
  }
  if (targetOrder >= curOrder) {
    throw new ApiError("Choose an earlier stage than the current one", 400);
  }
};
