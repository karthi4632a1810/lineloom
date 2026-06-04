/** Escape a cell for CSV (RFC-style quoting). */
export const escapeCsvCell = (value = "") => {
  const text = value == null ? "" : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export const rowsToCsv = (columns = [], rows = []) => {
  const header = columns.map((col) => escapeCsvCell(col.label)).join(",");
  const body = rows.map((row) =>
    columns.map((col) => escapeCsvCell(row[col.key] ?? "")).join(",")
  );
  return [header, ...body].join("\r\n");
};
