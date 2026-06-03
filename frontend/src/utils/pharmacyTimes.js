/** Mirrors backend resolvePharmacyTimes for display metrics. */
export const resolvePharmacyTimes = (tracking = {}) => {
  const logs = Array.isArray(tracking?.pharmacy_logs) ? tracking.pharmacy_logs : [];
  const requestTimes = [];
  const billTimes = [];
  const completedTimes = [];

  for (const entry of logs) {
    if (entry?.request_at) {
      requestTimes.push(new Date(entry.request_at).getTime());
    }
    const bill = entry?.bill_at ?? entry?.start;
    if (bill) {
      billTimes.push(new Date(bill).getTime());
    }
    const completed = entry?.completed_at ?? entry?.end;
    if (completed) {
      completedTimes.push(new Date(completed).getTime());
    }
  }

  const min = (arr) => (arr.length ? new Date(Math.min(...arr)) : null);
  const max = (arr) => (arr.length ? new Date(Math.max(...arr)) : null);

  let billAt = min(billTimes);
  let completedAt = max(completedTimes);
  const requestAt = min(requestTimes);

  if (!billAt && tracking?.pharmacy_start) {
    billAt = new Date(tracking.pharmacy_start);
  }
  if (!completedAt && tracking?.pharmacy_end) {
    completedAt = new Date(tracking.pharmacy_end);
  }

  return {
    requestAt: requestAt && !Number.isNaN(requestAt.getTime()) ? requestAt : null,
    billAt: billAt && !Number.isNaN(billAt.getTime()) ? billAt : null,
    completedAt: completedAt && !Number.isNaN(completedAt.getTime()) ? completedAt : null
  };
};
