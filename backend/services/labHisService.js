import { env } from "../config/env.js";
import { getLabPool } from "../config/labSql.js";
import { ApiError } from "../utils/apiError.js";
import { formatHisDateKey } from "../utils/hisDates.js";
import { getCachedHisQuery, hisCacheKey } from "../utils/hisQueryCache.js";
import { uniqueHisRegNumbers } from "../utils/hisRegNumbers.js";
import { logger } from "../utils/logger.js";

const escapeSqlLiteral = (value = "") => String(value ?? "").replace(/'/g, "''");

/** MM/DD/YYYY HH:mm for LabTestResultHistoryQB */
export const formatLabSpDateTime = (date = new Date(), endOfDay = false) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const year = d.getFullYear();
  const hour = endOfDay ? "23" : "00";
  const minute = endOfDay ? "59" : "00";
  return `${month}/${day}/${year} ${hour}:${minute}`;
};

export const parseReqNoFromCell = (value = "") => {
  const raw = String(value ?? "");
  const anchorMatch = raw.match(/>(\d+)</);
  if (anchorMatch) {
    return anchorMatch[1];
  }
  const digits = raw.replace(/\D/g, "");
  return digits || raw.trim();
};

/** Parses "03-06-2026 01:01" or "03-06-2026" from KMCH lab report. */
export const parseLabDateCell = (value = "") => {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }
  const match = raw.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!match) {
    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const hour = match[4] != null ? Number(match[4]) : 0;
  const minute = match[5] != null ? Number(match[5]) : 0;
  const parsed = new Date(
    Number(match[3]),
    Number(match[2]) - 1,
    Number(match[1]),
    hour,
    minute,
    0,
    0
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const mapLabRow = (row = {}) => ({
  reg_no: String(row["REG No"] ?? row.RegNo ?? row.reg_no ?? "").trim(),
  request_no: parseReqNoFromCell(row["REQ NO"] ?? row.ReqNo ?? row.request_no),
  request_at: parseLabDateCell(row["REQUEST DATE"] ?? row.RequestDate),
  sample_received_at: parseLabDateCell(row["DEPT RECEIVE DATE"] ?? row.DeptReceiveDate),
  completed_at: parseLabDateCell(row["COMPLETED DATE"] ?? row.CompletedDate),
  procedure: String(row.PROCEDURE ?? row.Procedure ?? "")
    .replace(/<[^>]*>/g, "")
    .trim(),
  status: String(row.STATUS ?? row.Status ?? "").trim(),
  dept: String(row["ORDERING DEPARTMENT"] ?? row.OrderingDepartment ?? "").trim(),
  bill_no: String(row["BILL NO"] ?? row.BillNo ?? "").trim()
});

const mergeLabGroup = (existing = null, row = {}) => {
  if (!existing) {
    return { ...row };
  }
  const pickEarlier = (a, b) => {
    if (!a) {
      return b;
    }
    if (!b) {
      return a;
    }
    return a.getTime() <= b.getTime() ? a : b;
  };
  const pickLater = (a, b) => {
    if (!a) {
      return b;
    }
    if (!b) {
      return a;
    }
    return a.getTime() >= b.getTime() ? a : b;
  };
  return {
    ...existing,
    request_at: pickEarlier(existing.request_at, row.request_at),
    sample_received_at: pickEarlier(existing.sample_received_at, row.sample_received_at),
    completed_at: pickLater(existing.completed_at, row.completed_at),
    status: row.completed_at ? row.status : existing.status || row.status,
    procedure: existing.procedure || row.procedure
  };
};

export const groupLabRowsByRequest = (rows = []) => {
  const groups = new Map();
  for (const row of rows) {
    const key = row.request_no || `${row.reg_no}-${row.request_at?.getTime() ?? "unknown"}`;
    groups.set(key, mergeLabGroup(groups.get(key), row));
  }
  return [...groups.values()].sort(
    (a, b) => (a.request_at?.getTime() ?? 0) - (b.request_at?.getTime() ?? 0)
  );
};

/**
 * @param {{ fromDate?: string, toDate?: string, regNo?: string }} filters
 */
export const fetchLabTestResultHistory = async (filters = {}) => {
  if (!env.hisEnabled) {
    throw new ApiError("HIS integration is disabled", 503);
  }
  const fromDate = String(filters.fromDate ?? "").trim();
  const toDate = String(filters.toDate ?? "").trim();
  if (!fromDate || !toDate) {
    throw new ApiError("Lab date range is required", 400);
  }

  const query = `
    EXEC dbo.LabTestResultHistoryQB
      @FromDate = '${escapeSqlLiteral(fromDate)}',
      @ToDate = '${escapeSqlLiteral(toDate)}',
      @RegNo = '${escapeSqlLiteral(filters.regNo ?? "")}',
      @RequestNo = '${escapeSqlLiteral(filters.requestNo ?? "")}',
      @IPNO = '${escapeSqlLiteral(filters.ipno ?? "")}',
      @BillNo = '${escapeSqlLiteral(filters.billNo ?? "")}',
      @PatName = '${escapeSqlLiteral(filters.patName ?? "")}',
      @BedNo = '${escapeSqlLiteral(filters.bedNo ?? "")}',
      @Dept = '${escapeSqlLiteral(filters.dept ?? "")}',
      @Doc = '${escapeSqlLiteral(filters.doc ?? "0")}',
      @Proc = '${escapeSqlLiteral(filters.proc ?? "0")}',
      @PatCategory = '${escapeSqlLiteral(filters.patCategory ?? "1,2,3")}',
      @Status = '${escapeSqlLiteral(filters.status ?? "0")}',
      @bDiscaintimation = '${escapeSqlLiteral(filters.bDiscaintimation ?? "1")}',
      @PatType = '${escapeSqlLiteral(filters.patType ?? "1")}',
      @Result = '${escapeSqlLiteral(filters.result ?? "1")}';
  `;

  try {
    const pool = await getLabPool();
    const request = pool.request();
    request.timeout = env.hisQueryTimeoutMs;
    const result = await request.query(query);
    const rows = (result?.recordset ?? []).map(mapLabRow).filter((item) => item.reg_no);
    return groupLabRowsByRequest(rows);
  } catch (error) {
    logger.error("Lab HIS query failed", { message: error?.message ?? "unknown" });
    throw new ApiError("Unable to fetch lab data from HIS", 503);
  }
};

/**
 * @param {string} regNo
 * @param {Date} [onDate]
 */
export const mergeLabGroups = (groupLists = []) => {
  const map = new Map();
  for (const list of groupLists) {
    if (!Array.isArray(list)) {
      continue;
    }
    for (const group of list) {
      const key = group.request_no || `${group.reg_no}-${group.request_at?.getTime() ?? "unknown"}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...group });
        continue;
      }
      map.set(key, mergeLabGroup(existing, group));
    }
  }
  return [...map.values()].sort(
    (a, b) => (a.request_at?.getTime() ?? 0) - (b.request_at?.getTime() ?? 0)
  );
};

/**
 * @param {string[]} regNos
 * @param {Date} [onDate]
 */
export const fetchLabHistoryForRegistrations = async (regNos = [], onDate = new Date()) => {
  const ids = uniqueHisRegNumbers(regNos);
  if (!ids.length) {
    return [];
  }
  if (ids.length === 1) {
    return fetchLabHistoryForRegistration(ids[0], onDate);
  }
  const batches = await Promise.all(
    ids.map((id) => fetchLabHistoryForRegistration(id, onDate).catch(() => []))
  );
  return mergeLabGroups(batches);
};

export const fetchLabHistoryForRegistration = async (regNo = "", onDate = new Date()) => {
  const normalizedReg = String(regNo ?? "").trim();
  if (!normalizedReg) {
    return [];
  }
  const day = onDate instanceof Date ? onDate : new Date(onDate);
  const dateKey = formatHisDateKey(day);
  return getCachedHisQuery(
    hisCacheKey(["lab", normalizedReg, dateKey]),
    env.hisCacheTtlMs,
    () =>
      fetchLabTestResultHistory({
        fromDate: formatLabSpDateTime(day, false),
        toDate: formatLabSpDateTime(day, true),
        regNo: normalizedReg
      })
  );
};
