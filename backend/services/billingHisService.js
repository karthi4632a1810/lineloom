import { env } from "../config/env.js";
import { getBillingPool, sql } from "../config/billingSql.js";
import { ApiError } from "../utils/apiError.js";
import { formatHisDateKey } from "../utils/hisDates.js";
import { getCachedHisQuery, hisCacheKey } from "../utils/hisQueryCache.js";
import { uniqueHisRegNumbers } from "../utils/hisRegNumbers.js";
import { logger } from "../utils/logger.js";

const escapeSqlLiteral = (value = "") => String(value ?? "").replace(/'/g, "''");

/** MM/DD/YYYY for Astil_BillDetailReportOP_QB */
export const formatBillingSpDate = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
};

export const parseBillNoFromCell = (value = "") => {
  const raw = String(value ?? "");
  const anchorMatch = raw.match(/>(\d+)</);
  if (anchorMatch) {
    return anchorMatch[1];
  }
  const digits = raw.replace(/\D/g, "");
  return digits || raw.trim();
};

/** Parses "03-06-2026  1:01AM" from KMCH billing report. */
export const parseBillDateCell = (value = "") => {
  const raw = String(value ?? "").trim().replace(/\s+/g, " ");
  const match = raw.match(
    /^(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i
  );
  if (!match) {
    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  let hour = Number(match[4]);
  const minute = Number(match[5]);
  const ampm = String(match[6]).toUpperCase();
  if (ampm === "PM" && hour < 12) {
    hour += 12;
  }
  if (ampm === "AM" && hour === 12) {
    hour = 0;
  }
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

const mapBillRow = (row = {}) => {
  const billNo = parseBillNoFromCell(row["BILL NO"] ?? row.BillNo ?? row.bill_no);
  const billDate = parseBillDateCell(row["BILL DATE"] ?? row.BillDate ?? row.bill_date);
  const regNo = String(row["REG NO"] ?? row.RegNo ?? row.reg_no ?? "").trim();
  const patientName = String(row["PATIENT NAME"] ?? row.PatName ?? "").trim();
  const amount = Number(row["BILL AMOUNT"] ?? row.BillAmount ?? row.bill_amount ?? 0);
  return {
    bill_no: billNo,
    bill_date: billDate,
    reg_no: regNo,
    patient_name: patientName,
    amount: Number.isFinite(amount) ? amount : 0,
    user_name: String(row["USER NAME"] ?? row.UserName ?? "").trim()
  };
};

/**
 * Runs Astil_BillDetailReportOP_QB on KMCH_Billing (BB_CONSTR).
 *
 * @param {{ fromDt?: string, toDt?: string, regNo?: string, billNo?: string, patName?: string }} filters
 */
export const fetchBillDetailReportOp = async (filters = {}) => {
  if (!env.hisEnabled) {
    throw new ApiError("HIS integration is disabled", 503);
  }
  const fromDt = String(filters.fromDt ?? "").trim();
  const toDt = String(filters.toDt ?? "").trim();
  if (!fromDt || !toDt) {
    throw new ApiError("Billing date range is required", 400);
  }
  const regNo = escapeSqlLiteral(filters.regNo ?? "");
  const billNo = escapeSqlLiteral(filters.billNo ?? "");
  const patName = escapeSqlLiteral(filters.patName ?? "");
  const companyId = escapeSqlLiteral(filters.companyId ?? "");
  const sessionCompanyId = escapeSqlLiteral(
    filters.sessionCompanyId ?? env.billingSessionCompanyId
  );
  const userId = escapeSqlLiteral(filters.userId ?? "0");

  const query = `
    EXEC dbo.Astil_BillDetailReportOP_QB
      @FromDt = '${escapeSqlLiteral(fromDt)}',
      @ToDt = '${escapeSqlLiteral(toDt)}',
      @BillNo = '${billNo}',
      @PatName = '${patName}',
      @RegNo = '${regNo}',
      @SessionCompanyId = '${sessionCompanyId}',
      @Userid = '${userId}',
      @CompanyId = '${companyId}';
  `;

  try {
    const pool = await getBillingPool();
    const request = pool.request();
    request.timeout = env.hisQueryTimeoutMs;
    const result = await request.query(query);
    const rows = result?.recordset ?? [];
    return rows
      .map(mapBillRow)
      .filter((item) => item.reg_no && item.bill_date && item.amount > 0);
  } catch (error) {
    logger.error("Billing HIS query failed", { message: error?.message ?? "unknown" });
    throw new ApiError("Unable to fetch billing data from HIS", 503);
  }
};

/**
 * @param {string} regNo
 * @param {Date} [onDate]
 */
const mergeBills = (billLists = []) => {
  const map = new Map();
  for (const list of billLists) {
    if (!Array.isArray(list)) {
      continue;
    }
    for (const bill of list) {
      const key = bill.bill_no || `${bill.reg_no}-${bill.bill_date?.getTime() ?? "unknown"}`;
      if (!map.has(key)) {
        map.set(key, bill);
      }
    }
  }
  return [...map.values()].sort(
    (a, b) => (a.bill_date?.getTime() ?? 0) - (b.bill_date?.getTime() ?? 0)
  );
};

/**
 * @param {string[]} regNos
 * @param {Date} [onDate]
 */
export const fetchBillsForRegistrations = async (regNos = [], onDate = new Date()) => {
  const ids = uniqueHisRegNumbers(regNos);
  if (!ids.length) {
    return [];
  }
  if (ids.length === 1) {
    return fetchBillsForRegistration(ids[0], onDate);
  }
  const batches = await Promise.all(
    ids.map((id) => fetchBillsForRegistration(id, onDate).catch(() => []))
  );
  return mergeBills(batches);
};

export const fetchBillsForRegistration = async (regNo = "", onDate = new Date()) => {
  const normalizedReg = String(regNo ?? "").trim();
  if (!normalizedReg) {
    return [];
  }
  const day = onDate instanceof Date ? onDate : new Date(onDate);
  const spDate = formatBillingSpDate(day);
  const dateKey = formatHisDateKey(day);
  return getCachedHisQuery(
    hisCacheKey(["billing", normalizedReg, dateKey]),
    env.hisCacheTtlMs,
    () =>
      fetchBillDetailReportOp({
        fromDt: spDate,
        toDt: spDate,
        regNo: normalizedReg
      })
  );
};
