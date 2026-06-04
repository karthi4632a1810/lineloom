/**
 * HIS datetimes: exact values from SQL CONVERT (style 121) — no JS timezone or clock correction.
 */

/** yyyy-mm-dd hh:mi:ss.mmm — same as SSMS for datetime columns */
export const sqlDateTimeExpr = (column) => `CONVERT(VARCHAR(23), ${column}, 121)`;

/**
 * Admission for UI: only when SQL says the value is not after GETDATE().
 * HIS sometimes stores dIP_dt/dOP_dt with a fast server clock (evening while GETDATE is morning).
 */
export const sqlAdmissionDisplayExpr = (column) =>
  `CASE WHEN ${column} > GETDATE() THEN NULL ELSE ${sqlDateTimeExpr(column)} END`;

/**
 * Exclude Z / mock patients (KMCH: registered under system user 9999 on Mast_Patient / admission).
 * @param {number[]} mockUserIds
 */
export const sqlExcludeMockPatientOp = (mockUserIds = []) => {
  const ids = mockUserIds.filter((n) => Number.isFinite(n));
  if (!ids.length) {
    return "1 = 1";
  }
  const list = ids.join(", ");
  return `pm.iUser_id NOT IN (${list}) AND ISNULL(op.iUser_id, -1) NOT IN (${list})`;
};

export const sqlExcludeMockPatientIp = (mockUserIds = []) => {
  const ids = mockUserIds.filter((n) => Number.isFinite(n));
  if (!ids.length) {
    return "1 = 1";
  }
  const list = ids.join(", ");
  return `pm.iUser_id NOT IN (${list}) AND ISNULL(ip.iUser_id, -1) NOT IN (${list})`;
};

/** yyyy-mm-dd */
export const sqlDateExpr = (column) => `CONVERT(VARCHAR(10), ${column}, 23)`;

/** Trim milliseconds; keep wall-clock digits exactly as SQL returned them. */
export const passThroughSqlDateTime = (value = null) => {
  if (value == null || value === "") {
    return "";
  }
  if (typeof value === "string") {
    const s = String(value).trim().replace("T", " ");
    const match = s.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})/);
    if (match) {
      const pad = (n) => String(n).padStart(2, "0");
      return `${match[1]} ${pad(match[2])}:${pad(match[3])}:${pad(match[4])}`;
    }
    return s.slice(0, 23);
  }
  // Driver returned Date — should not happen when SELECT uses sqlDateTimeExpr
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export const passThroughSqlDate = (value = null) => {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }
  if (raw.length <= 10 && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }
  const dateTime = passThroughSqlDateTime(value);
  return dateTime ? dateTime.slice(0, 10) : "";
};
