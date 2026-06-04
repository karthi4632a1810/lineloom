import { resolveLabTimes } from "./labTimes.js";
import { resolvePharmacyTimes } from "./pharmacyTimes.js";

const toMs = (value) => {
  if (!value) {
    return null;
  }
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

/** Latest milestone when the visit was finished (stored or inferred). */
export const resolveVisitCompletedAt = (tracking = {}, token = {}) => {
  if (tracking?.visit_completed_at) {
    return new Date(tracking.visit_completed_at);
  }
  const candidates = [];
  const push = (value) => {
    const ms = toMs(value);
    if (ms != null) {
      candidates.push(ms);
    }
  };
  push(tracking.care_end);
  push(tracking.billing_end);
  push(tracking.pharmacy_end);
  const { completedAt: pharmacyCompletedAt } = resolvePharmacyTimes(tracking);
  push(pharmacyCompletedAt);
  const { completedAt: labCompletedAt } = resolveLabTimes(tracking);
  push(labCompletedAt);
  push(tracking.lab_end);
  if (String(token?.status ?? "").toUpperCase() === "COMPLETED") {
    push(token.updated_at);
    push(token.created_at);
  }
  if (!candidates.length) {
    return null;
  }
  return new Date(Math.max(...candidates));
};
