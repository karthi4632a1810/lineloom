const toMs = (start = null, end = null) => {
  if (!start || !end) {
    return null;
  }
  return Math.max(new Date(end).getTime() - new Date(start).getTime(), 0);
};

const toMinutes = (ms = null) => {
  if (ms == null) {
    return null;
  }
  return Number((ms / 60000).toFixed(2));
};

/**
 * Treatment clock starts at care_start. When consult_end is set, use the later of
 * care_start and consult_end so idle time between consult end and treatment start
 * is never counted as treatment, and overlap with consulting is avoided.
 */
export const resolveEffectiveTreatmentStart = (careStart = null, consultEnd = null) => {
  if (!careStart) {
    return null;
  }
  if (!consultEnd) {
    return careStart;
  }
  const a = new Date(careStart).getTime();
  const b = new Date(consultEnd).getTime();
  if (Number.isNaN(a)) {
    return null;
  }
  if (Number.isNaN(b)) {
    return careStart;
  }
  return a >= b ? careStart : consultEnd;
};

export const calculateTimeMetrics = (tracking = {}) => {
  const waitingMs = toMs(tracking.waiting_start, tracking.consult_start);
  const consultMs = toMs(tracking.consult_start, tracking.consult_end);
  const careStart = resolveEffectiveTreatmentStart(tracking.care_start, tracking.consult_end);
  const careMs = toMs(careStart, tracking.care_end);
  const breakMs = toMs(tracking.break_start, tracking.break_end);
  const billingMs = toMs(tracking.billing_start, tracking.billing_end);
  const labWaitMs = toMs(tracking.billing_end, tracking.lab_start);
  const labMs = toMs(tracking.lab_start, tracking.lab_end);

  return {
    waiting_time_minutes: toMinutes(waitingMs),
    consult_time_minutes: toMinutes(consultMs),
    care_time_minutes: toMinutes(careMs),
    break_time_minutes: toMinutes(breakMs),
    billing_time_minutes: toMinutes(billingMs),
    lab_wait_time_minutes: toMinutes(labWaitMs),
    lab_test_time_minutes: toMinutes(labMs)
  };
};
