/** Mirrors backend `revertMilestones.js` for UI (anchor list + preview). */

export const VISIT_STAGE_ORDER = {
  waiting: 0,
  consult_open: 1,
  consult_closed: 2,
  lab: 3,
  lab_done: 4,
  treatment: 5
};

const ANCHOR_LABELS = {
  waiting: "Waiting pool",
  consult_open: "Consult in progress",
  consult_closed: "After consult (before labs / treatment)",
  lab: "Lab testing",
  lab_done: "After lab (before treatment)"
};

const ANCHOR_ORDER_KEYS = Object.keys(VISIT_STAGE_ORDER).filter((k) => k !== "treatment");

const NOTE_CLEAR = { consult_note: "", referred_department: "" };

export const buildTrackingFromRow = (row = {}) => ({
  consult_start: row.consult_start ?? null,
  consult_end: row.consult_end ?? null,
  billing_start: row.billing_start ?? null,
  billing_end: row.billing_end ?? null,
  lab_start: row.lab_start ?? null,
  lab_end: row.lab_end ?? null,
  care_start: row.care_start ?? row.treatment_start ?? null,
  care_end: row.care_end ?? row.treatment_end ?? null
});

export const detectVisitStage = (row = {}) => {
  const status = String(row?.status ?? "").replace(/^ACTIVE$/i, "WAITING");
  if (status === "COMPLETED") {
    return "completed";
  }
  if (status === "WAITING") {
    return "waiting";
  }
  if (status === "IN_TREATMENT") {
    return "treatment";
  }
  if (status !== "CONSULTING") {
    return "waiting";
  }
  const tr = buildTrackingFromRow(row);
  if (tr.care_start) {
    return "treatment";
  }
  if (tr.lab_end) {
    return "lab_done";
  }
  if (tr.lab_start) {
    return "lab";
  }
  if (tr.consult_end) {
    return "consult_closed";
  }
  if (tr.consult_start) {
    return "consult_open";
  }
  return "waiting";
};

export const buildRevertPatchForAnchor = (anchor = "") => {
  const a = String(anchor ?? "").trim();
  const base = { ...NOTE_CLEAR };
  switch (a) {
    case "waiting":
      return {
        ...base,
        consult_start: null,
        consult_end: null,
        lab_start: null,
        lab_end: null,
        care_start: null,
        care_end: null
      };
    case "consult_open":
      return {
        ...base,
        consult_end: null,
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

/** Flat row shape for `detectVisitStage` / display (matches queue/detail field names). */
export const buildDisplayRowFromMergedTracking = (baseRow = {}, merged = {}, statusOverride = null) => ({
  ...baseRow,
  status: statusOverride ?? resolveStatusAfterRevert(merged),
  consult_start: merged.consult_start ?? null,
  consult_end: merged.consult_end ?? null,
  billing_start: merged.billing_start ?? null,
  billing_end: merged.billing_end ?? null,
  lab_start: merged.lab_start ?? null,
  lab_end: merged.lab_end ?? null,
  care_start: merged.care_start ?? null,
  care_end: merged.care_end ?? null,
  treatment_start: merged.care_start ?? null,
  treatment_end: merged.care_end ?? null
});

/** Human-readable phase while `token.status` may stay CONSULTING through billing/lab. */
export const getVisitPhaseLabel = (row = {}) => {
  const stage = detectVisitStage(row);
  const labels = {
    completed: "Completed",
    waiting: "Waiting",
    consult_open: "In consulting",
    consult_closed: "Consult ended",
    lab: "Lab testing",
    lab_done: "Post-lab",
    treatment: "In treatment"
  };
  return labels[stage] ?? String(row?.status ?? "—");
};

/**
 * Second class for `status-chip` (first class is always `status-chip`).
 * Maps journey phase to colors distinct from raw API status.
 */
export const getVisitPhaseChipClass = (row = {}) => {
  const stage = detectVisitStage(row);
  const map = {
    waiting: "status-waiting",
    completed: "status-completed",
    treatment: "status-in_treatment",
    consult_open: "status-consulting",
    consult_closed: "visit-phase-postconsult",
    lab: "visit-phase-labtest",
    lab_done: "visit-phase-postlab"
  };
  return map[stage] ?? "status-consulting";
};

export const getRevertPreviewForAnchor = (row = {}, anchor = "") => {
  const patch = buildRevertPatchForAnchor(anchor);
  if (!patch) {
    return null;
  }
  const merged = { ...buildTrackingFromRow(row) };
  Object.assign(merged, patch);
  const previewStatus = resolveStatusAfterRevert(merged);
  const afterRow = buildDisplayRowFromMergedTracking(row, merged, previewStatus);
  const detailLines = {
    waiting: "Clears consultation and every step after admission. Token returns to the waiting pool.",
    consult_open:
      "Reopens consultation: consult end, lab, and treatment timestamps after that are cleared.",
    consult_closed:
      "Returns to post-consult state: lab and treatment progress after the consult is cleared.",
    lab: "Returns to lab in progress: lab end and treatment are cleared.",
    lab_done: "Clears treatment start/end only; visit stays after lab until treatment starts again."
  };
  return {
    previewStatus,
    previewPhaseLabel: getVisitPhaseLabel(afterRow),
    previewPhaseChipClass: getVisitPhaseChipClass(afterRow),
    previewDetail: detailLines[anchor] ?? ""
  };
};

/**
 * Valid earlier milestones for this row (journey order: earliest → latest).
 */
export const getAvailableRevertAnchors = (row = {}) => {
  const current = detectVisitStage(row);
  if (current === "completed" || current === "waiting") {
    return [];
  }
  const curOrder = VISIT_STAGE_ORDER[current];
  if (curOrder == null) {
    return [];
  }
  return ANCHOR_ORDER_KEYS.filter((a) => VISIT_STAGE_ORDER[a] < curOrder)
    .sort((a, b) => VISIT_STAGE_ORDER[a] - VISIT_STAGE_ORDER[b])
    .map((anchor) => ({
      anchor,
      label: ANCHOR_LABELS[anchor] ?? anchor
    }));
};

export const canRevertVisit = (row = {}) => getAvailableRevertAnchors(row).length > 0;
