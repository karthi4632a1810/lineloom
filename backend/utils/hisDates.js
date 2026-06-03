/** Local calendar day key for HIS query cache. */
export const formatHisDateKey = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Prefer consult end day; fall back to token created day. */
export const resolveHisLookupDate = (token = null, tracking = null) => {
  if (tracking?.consult_end) {
    const consultEnd = new Date(tracking.consult_end);
    if (!Number.isNaN(consultEnd.getTime())) {
      return consultEnd;
    }
  }
  if (token?.created_at) {
    const created = new Date(token.created_at);
    if (!Number.isNaN(created.getTime())) {
      return created;
    }
  }
  return new Date();
};
