import { resolveLabTimes } from "./labTimes.js";
import { resolvePharmacyTimes } from "./pharmacyTimes.js";

const toMs = (value) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
};

const segmentMinutes = (start, end, inProgress) => {
  const startMs = toMs(start);
  if (startMs == null) {
    return null;
  }
  const endMs = end ? toMs(end) : inProgress ? Date.now() : null;
  if (endMs == null) {
    return null;
  }
  return Number(((endMs - startMs) / 60000).toFixed(2));
};

const normalizePharmacyLog = (row = {}) => {
  const start = row.bill_at ?? row.request_at ?? row.start ?? null;
  const end = row.completed_at ?? row.end ?? null;
  if (!toMs(start)) {
    return null;
  }
  return {
    start,
    end,
    bill_no: String(row.bill_no ?? "").trim(),
    issue_type: String(row.issue_type ?? "").trim()
  };
};

const normalizeLabLog = (row = {}) => {
  const start = row.sample_received_at ?? row.request_at ?? row.start ?? null;
  const end = row.completed_at ?? row.end ?? null;
  if (!toMs(start) && !toMs(row.request_at)) {
    return null;
  }
  return {
    start: start ?? row.request_at,
    end,
    request_at: row.request_at ?? null,
    request_no: String(row.request_no ?? "").trim(),
    procedure: String(row.procedure ?? "").trim()
  };
};

/**
 * Patient Journey steps from token + tracking (includes HIS pharmacy/lab/billing).
 */
export const buildJourneyStepsFromTracking = (tracking = {}, token = {}) => {
  const status = token.status === "ACTIVE" ? "WAITING" : token.status;
  const steps = [];

  if (tracking.waiting_start) {
    const open = status === "WAITING" && !tracking.consult_start;
    steps.push({
      kind: "waiting",
      label: "Waiting",
      start: tracking.waiting_start,
      end: tracking.consult_start ?? null,
      duration_minutes: segmentMinutes(tracking.waiting_start, tracking.consult_start, open),
      in_progress: open
    });
  }

  if (tracking.consult_start) {
    const open = status === "CONSULTING" && !tracking.consult_end;
    steps.push({
      kind: "consultation",
      label: "Consultation",
      start: tracking.consult_start,
      end: tracking.consult_end ?? null,
      duration_minutes: segmentMinutes(tracking.consult_start, tracking.consult_end, open),
      in_progress: open
    });
  }

  const pharmacyLogs = (Array.isArray(tracking.pharmacy_logs) ? tracking.pharmacy_logs : [])
    .map(normalizePharmacyLog)
    .filter(Boolean);
  const pharmacyTimes = resolvePharmacyTimes(tracking);

  if (tracking.consult_end && pharmacyLogs.length && pharmacyTimes.billAt) {
    const firstBillMs = Math.min(...pharmacyLogs.map((row) => toMs(row.start)).filter((ms) => ms != null));
    if (firstBillMs > toMs(tracking.consult_end)) {
      steps.push({
        kind: "pharmacy_queue",
        label: "Pharmacy queue",
        start: tracking.consult_end,
        end: new Date(firstBillMs),
        duration_minutes: segmentMinutes(tracking.consult_end, new Date(firstBillMs), false),
        in_progress: false
      });
    }
  }

  if (pharmacyLogs.length) {
    pharmacyLogs.forEach((row, idx) => {
      const open = status === "CONSULTING" && !row.end;
      const billLabel = row.bill_no ? ` · Bill ${row.bill_no}` : "";
      steps.push({
        kind: "pharmacy",
        label: pharmacyLogs.length > 1 ? `Pharmacy #${idx + 1}${billLabel}` : `Pharmacy${billLabel}`,
        start: row.start,
        end: row.end ?? null,
        duration_minutes: segmentMinutes(row.start, row.end, open),
        in_progress: open,
        bill_no: row.bill_no,
        issue_type: row.issue_type
      });
    });
  } else if (tracking.pharmacy_start || tracking.pharmacy_end || pharmacyTimes.billAt) {
    const start = tracking.pharmacy_start ?? pharmacyTimes.billAt ?? tracking.consult_end;
    const end = tracking.pharmacy_end ?? pharmacyTimes.completedAt ?? null;
    const open = status === "CONSULTING" && start && !end;
    steps.push({
      kind: "pharmacy",
      label: "Pharmacy",
      start,
      end,
      duration_minutes: segmentMinutes(start, end, open),
      in_progress: open
    });
  }

  const labLogs = (Array.isArray(tracking.lab_logs) ? tracking.lab_logs : [])
    .map(normalizeLabLog)
    .filter(Boolean);
  const labTimes = resolveLabTimes(tracking);
  const inLabPath =
    Boolean(tracking.labs_ordered) ||
    Boolean(tracking.lab_start) ||
    Boolean(tracking.lab_end) ||
    labLogs.length > 0;

  if (tracking.consult_end && inLabPath) {
    const firstLabMs =
      labLogs.length > 0
        ? Math.min(
            ...labLogs.map((row) => toMs(row.start) ?? toMs(row.request_at)).filter((ms) => ms != null)
          )
        : toMs(tracking.lab_start);
    if (!firstLabMs || firstLabMs > toMs(tracking.consult_end)) {
      const open = status === "CONSULTING" && !firstLabMs;
      steps.push({
        kind: "lab_queue",
        label: "Lab queue",
        start: tracking.consult_end,
        end: firstLabMs ? new Date(firstLabMs) : null,
        duration_minutes: segmentMinutes(
          tracking.consult_end,
          firstLabMs ? new Date(firstLabMs) : null,
          open
        ),
        in_progress: open
      });
    }
  }

  if (labLogs.length) {
    labLogs.forEach((row, idx) => {
      const open = status === "CONSULTING" && !row.end;
      const reqLabel = row.request_no ? ` · Req ${row.request_no}` : "";
      steps.push({
        kind: "lab",
        label: labLogs.length > 1 ? `Lab #${idx + 1}${reqLabel}` : `Lab${reqLabel}`,
        start: row.start,
        end: row.end ?? null,
        duration_minutes: segmentMinutes(row.start, row.end, open),
        in_progress: open,
        request_no: row.request_no
      });
    });
  } else if (tracking.lab_start) {
    const open = status === "CONSULTING" && !tracking.lab_end;
    steps.push({
      kind: "lab",
      label: "Lab",
      start: tracking.lab_start,
      end: tracking.lab_end ?? null,
      duration_minutes: segmentMinutes(tracking.lab_start, tracking.lab_end, open),
      in_progress: open
    });
  }

  const billingPayments = Array.isArray(tracking.billing_payments) ? tracking.billing_payments : [];
  const paymentTimes = billingPayments
    .map((p) => p?.paid_at)
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  const billingStart =
    tracking.billing_start ??
    (paymentTimes.length ? paymentTimes[0] : null);
  const billingEnd =
    tracking.billing_end ?? (paymentTimes.length ? paymentTimes[paymentTimes.length - 1] : null);

  if (billingStart || billingEnd || paymentTimes.length) {
    const open = Boolean(tracking.billing_start) && !billingEnd;
    steps.push({
      kind: "billing",
      label: "Billing",
      start: billingStart ?? billingEnd,
      end: billingEnd ?? null,
      duration_minutes: segmentMinutes(billingStart ?? billingEnd, billingEnd, open),
      in_progress: open
    });
  }

  if (tracking.care_start || tracking.care_end) {
    const open = status === "IN_TREATMENT" && !tracking.care_end;
    steps.push({
      kind: "treatment",
      label: "Treatment",
      start: tracking.care_start,
      end: tracking.care_end ?? null,
      duration_minutes: segmentMinutes(tracking.care_start, tracking.care_end, open),
      in_progress: open
    });
  }

  if (token.status === "COMPLETED") {
    steps.push({
      kind: "completed",
      label: "Visit completed",
      start: tracking.care_end ?? billingEnd ?? tracking.pharmacy_end ?? tracking.consult_end,
      end: null,
      duration_minutes: null,
      in_progress: false
    });
  }

  return steps
    .filter((row) => row.start || row.kind === "completed")
    .sort((a, b) => (toMs(a.start) ?? 0) - (toMs(b.start) ?? 0));
};

export const mapJourneyStepForDisplay = (seg = {}, formatDateTime = (v) => String(v ?? "")) => ({
  kind: String(seg.kind ?? "").toLowerCase(),
  label: seg.label,
  bill_no: seg.bill_no,
  request_no: seg.request_no,
  issue_type: seg.issue_type,
  timePrimary: seg.in_progress
    ? "In progress"
    : seg.duration_minutes != null
      ? `${seg.duration_minutes} min`
      : "--",
  timeSecondary: `${formatDateTime(seg.start)}${seg.end ? ` → ${formatDateTime(seg.end)}` : ""}`,
  done: Boolean(seg.end) && !seg.in_progress,
  active: Boolean(seg.in_progress)
});
