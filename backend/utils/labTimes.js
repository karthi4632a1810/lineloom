/**
 * Resolve lab milestone times from HIS-synced lab_logs and legacy lab_start/lab_end.
 */
export const resolveLabTimes = (tracking = {}) => {
  const logs = Array.isArray(tracking?.lab_logs) ? tracking.lab_logs : [];
  const requestTimes = [];
  const sampleTimes = [];
  const completedTimes = [];

  for (const entry of logs) {
    if (entry?.request_at) {
      requestTimes.push(new Date(entry.request_at).getTime());
    }
    const sample = entry?.sample_received_at ?? entry?.start;
    if (sample) {
      sampleTimes.push(new Date(sample).getTime());
    }
    const completed = entry?.completed_at ?? entry?.end;
    if (completed) {
      completedTimes.push(new Date(completed).getTime());
    }
  }

  const min = (arr) => (arr.length ? new Date(Math.min(...arr)) : null);
  const max = (arr) => (arr.length ? new Date(Math.max(...arr)) : null);

  const requestAt = min(requestTimes);
  let sampleAt = min(sampleTimes);
  let completedAt = max(completedTimes);

  if (!sampleAt && tracking?.lab_start) {
    sampleAt = new Date(tracking.lab_start);
  }
  if (!completedAt && tracking?.lab_end) {
    completedAt = new Date(tracking.lab_end);
  }

  return {
    requestAt: requestAt && !Number.isNaN(requestAt.getTime()) ? requestAt : null,
    sampleAt: sampleAt && !Number.isNaN(sampleAt.getTime()) ? sampleAt : null,
    completedAt: completedAt && !Number.isNaN(completedAt.getTime()) ? completedAt : null
  };
};
