/**
 * Format API datetime strings from SQL (yyyy-mm-dd hh:mm:ss) — digits only, no timezone shift.
 */

const pad2 = (n) => String(n).padStart(2, "0");

/** Display SQL wall-clock string (dd/mm/yyyy, 12-hour) without changing the time value. */
export const formatDateTimeDisplay = (value = null, empty = "--") => {
  if (value == null || value === "") {
    return empty;
  }
  const s = String(value).trim().replace("T", " ");
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (!match) {
    return s || empty;
  }
  const hour = Number(match[4]);
  const ampm = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 || 12;
  return `${match[3]}/${match[2]}/${match[1]}, ${hour12}:${pad2(match[5])}:${pad2(match[6])} ${ampm}`;
};

/** Show SQL value as 24h clock (optional raw display). */
export const formatSqlDateTimeRaw = (value = null, empty = "--") => {
  if (value == null || value === "") {
    return empty;
  }
  const s = String(value).trim().replace("T", " ");
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}:\d{2}:\d{2})/);
  if (!match) {
    return s || empty;
  }
  return `${match[3]}/${match[2]}/${match[1]} ${match[4]}`;
};

export const parseHospitalDateTime = (raw = "") => {
  const s = String(raw ?? "").trim();
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})[\sT](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    return null;
  }
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? 0)
  );
};
