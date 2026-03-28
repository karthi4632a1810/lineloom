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

export const calculateTimeMetrics = (tracking = {}) => {
  const waitingMs = toMs(tracking.waiting_start, tracking.consult_start);
  const consultMs = toMs(tracking.consult_start, tracking.consult_end);
  const careMs = toMs(tracking.care_start, tracking.care_end);
  const breakMs = toMs(tracking.break_start, tracking.break_end);

  return {
    waiting_time_minutes: toMinutes(waitingMs),
    consult_time_minutes: toMinutes(consultMs),
    care_time_minutes: toMinutes(careMs),
    break_time_minutes: toMinutes(breakMs)
  };
};
