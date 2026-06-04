import { env } from "../config/env.js";
import { getPharmacyPool } from "../config/pharmacySql.js";
import { ApiError } from "../utils/apiError.js";
import { formatHisDateKey } from "../utils/hisDates.js";
import { getCachedHisQuery, hisCacheKey } from "../utils/hisQueryCache.js";
import { uniqueHisRegNumbers } from "../utils/hisRegNumbers.js";
import { logger } from "../utils/logger.js";

const escapeSqlLiteral = (value = "") => String(value ?? "").replace(/'/g, "''");

/** MM/DD/YYYY HH:mm for Pharm_Rpt_Sales_Details_QB */
export const formatPharmacySpDateTime = (date = new Date(), endOfDay = false) => {
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

export const parseBillNoFromCell = (value = "") => {
  const raw = String(value ?? "");
  const anchorMatch = raw.match(/>(\d+)</);
  if (anchorMatch) {
    return anchorMatch[1];
  }
  const digits = raw.replace(/\D/g, "");
  return digits || raw.trim();
};

/** Resolve SP column names regardless of spacing/casing from mssql driver. */
export const pickSqlColumn = (row = {}, ...candidates) => {
  if (!row || typeof row !== "object") {
    return undefined;
  }
  for (const name of candidates) {
    const value = row[name];
    if (value != null && value !== "") {
      return value;
    }
  }
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const norm = String(candidate).replace(/\s+/g, "").toLowerCase();
    const key = keys.find((k) => k.replace(/\s+/g, "").toLowerCase() === norm);
    if (key != null && row[key] != null && row[key] !== "") {
      return row[key];
    }
  }
  return undefined;
};

/** Parses "03-06-2026 08:41" from KMCH pharmacy report. */
export const parsePharmacyDateCell = (value = "") => {
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

const mapPharmacyRow = (row = {}) => ({
  reg_no: String(
    pickSqlColumn(row, "REG / IP NO", "REG/IP NO", "RegNo", "reg_no") ?? ""
  ).trim(),
  bill_no: parseBillNoFromCell(
    pickSqlColumn(row, "BILL NO", "Bill No", "BillNo", "bill_no", "BILLNO")
  ),
  request_no: String(
    pickSqlColumn(row, "REQUEST NO", "Request No", "RequestNo", "request_no", "REQUESTNO") ?? ""
  ).trim(),
  request_at: parsePharmacyDateCell(
    pickSqlColumn(row, "REQUEST DATE", "Request Date", "RequestDate", "request_date")
  ),
  bill_at: parsePharmacyDateCell(
    pickSqlColumn(row, "BILL DATE", "Bill Date", "BillDate", "bill_date")
  ),
  completed_at: parsePharmacyDateCell(
    pickSqlColumn(row, "APPROVE DATE", "Approve Date", "ApproveDate", "approve_date")
  ),
  issue_type: String(pickSqlColumn(row, "ISSUE TYPE", "Issue Type", "IssueType") ?? "").trim(),
  dept: String(pickSqlColumn(row, "DEPARTMENT", "Department", "dept") ?? "").trim(),
  patient_name: String(
    pickSqlColumn(row, "PATIENT NAME", "Patient Name", "PatientName") ?? ""
  ).trim()
});

const mergePharmacyGroup = (existing = null, row = {}) => {
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
    bill_no: String(row.bill_no || existing.bill_no || "").trim(),
    request_no: String(row.request_no || existing.request_no || "").trim(),
    request_at: pickEarlier(existing.request_at, row.request_at),
    bill_at: pickEarlier(existing.bill_at, row.bill_at),
    completed_at: pickLater(existing.completed_at, row.completed_at),
    issue_type: row.issue_type || existing.issue_type,
    dept: row.dept || existing.dept,
    patient_name: row.patient_name || existing.patient_name
  };
};

export const groupPharmacyRowsByBill = (rows = []) => {
  const groups = new Map();
  for (const row of rows) {
    const key = row.bill_no || `${row.reg_no}-${row.bill_at?.getTime() ?? "unknown"}`;
    groups.set(key, mergePharmacyGroup(groups.get(key), row));
  }
  return [...groups.values()].sort(
    (a, b) => (a.bill_at?.getTime() ?? 0) - (b.bill_at?.getTime() ?? 0)
  );
};

/**
 * @param {{ fromDate?: string, toDate?: string, regNo?: string }} filters
 */
export const fetchPharmacySalesDetails = async (filters = {}) => {
  if (!env.hisEnabled) {
    throw new ApiError("HIS integration is disabled", 503);
  }
  const fromDate = String(filters.fromDate ?? "").trim();
  const toDate = String(filters.toDate ?? "").trim();
  if (!fromDate || !toDate) {
    throw new ApiError("Pharmacy date range is required", 400);
  }

  const query = `
    EXEC dbo.Pharm_Rpt_Sales_Details_QB
      @FrmDt = '${escapeSqlLiteral(fromDate)}',
      @ToDt = '${escapeSqlLiteral(toDate)}',
      @RegNo = '${escapeSqlLiteral(filters.regNo ?? "")}',
      @IPNo = '${escapeSqlLiteral(filters.ipno ?? "")}',
      @FrBill = '${escapeSqlLiteral(filters.frBill ?? "")}',
      @ToBill = '${escapeSqlLiteral(filters.toBill ?? "")}',
      @DocId = '${escapeSqlLiteral(filters.docId ?? "0")}',
      @Opt = '${escapeSqlLiteral(filters.opt ?? env.pharmacyReportOpt)}',
      @IsDrug = '${escapeSqlLiteral(filters.isDrug ?? "10000")}',
      @SalTyp = '${escapeSqlLiteral(filters.salTyp ?? "0")}',
      @IssTyp = '${escapeSqlLiteral(filters.issTyp ?? "0")}',
      @UserId = '${escapeSqlLiteral(filters.userId ?? "0")}',
      @DeptId = '${escapeSqlLiteral(filters.deptId ?? "0")}',
      @DBTypeId = '${escapeSqlLiteral(filters.dbTypeId ?? "")}',
      @RptType = '${escapeSqlLiteral(filters.rptType ?? "0")}',
      @Type = '${escapeSqlLiteral(filters.type ?? "0")}',
      @DBPkgeId = '${escapeSqlLiteral(filters.dbPkgeId ?? "")}',
      @StrId = '${escapeSqlLiteral(filters.strId ?? env.pharmacyStrId)}',
      @IsPaid = '${escapeSqlLiteral(filters.isPaid ?? "0")}',
      @PatType = '${escapeSqlLiteral(filters.patType ?? "0")}',
      @PatTypId = '${escapeSqlLiteral(filters.patTypId ?? "0")}',
      @IsHighRisk = '${escapeSqlLiteral(filters.isHighRisk ?? "10000")}',
      @CorpId = '${escapeSqlLiteral(filters.corpId ?? "")}',
      @ShowPrint = '${escapeSqlLiteral(filters.showPrint ?? "1")}',
      @DrugId = '${escapeSqlLiteral(filters.drugId ?? "")}';
  `;

  try {
    const pool = await getPharmacyPool();
    const request = pool.request();
    request.timeout = env.hisQueryTimeoutMs;
    const result = await request.query(query);
    const rows = (result?.recordset ?? [])
      .map(mapPharmacyRow)
      .filter((item) => item.reg_no && (item.bill_at || item.request_at));
    return groupPharmacyRowsByBill(rows);
  } catch (error) {
    logger.error("Pharmacy HIS query failed", { message: error?.message ?? "unknown" });
    throw new ApiError("Unable to fetch pharmacy data from HIS", 503);
  }
};

/**
 * @param {string} regNo
 * @param {Date} [onDate]
 */
export const mergePharmacyGroups = (groupLists = []) => {
  const map = new Map();
  for (const list of groupLists) {
    if (!Array.isArray(list)) {
      continue;
    }
    for (const group of list) {
      const key = group.bill_no || `${group.reg_no}-${group.bill_at?.getTime() ?? "unknown"}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...group });
        continue;
      }
      map.set(key, mergePharmacyGroup(existing, group));
    }
  }
  return [...map.values()].sort(
    (a, b) => (a.bill_at?.getTime() ?? 0) - (b.bill_at?.getTime() ?? 0)
  );
};

/**
 * @param {string[]} regNos OP/IP visit reg and/or patient iReg_No
 * @param {Date} [onDate]
 */
export const fetchPharmacyForRegistrations = async (regNos = [], onDate = new Date()) => {
  const ids = uniqueHisRegNumbers(regNos);
  if (!ids.length) {
    return [];
  }
  if (ids.length === 1) {
    return fetchPharmacyForRegistration(ids[0], onDate);
  }
  const batches = await Promise.all(
    ids.map((id) => fetchPharmacyForRegistration(id, onDate).catch(() => []))
  );
  return mergePharmacyGroups(batches);
};

export const fetchPharmacyForRegistration = async (regNo = "", onDate = new Date()) => {
  const normalizedReg = String(regNo ?? "").trim();
  if (!normalizedReg) {
    return [];
  }
  const day = onDate instanceof Date ? onDate : new Date(onDate);
  const dateKey = formatHisDateKey(day);
  return getCachedHisQuery(
    hisCacheKey(["pharmacy", normalizedReg, dateKey]),
    env.hisCacheTtlMs,
    () =>
      fetchPharmacySalesDetails({
        fromDate: formatPharmacySpDateTime(day, false),
        toDate: formatPharmacySpDateTime(day, true),
        regNo: normalizedReg
      })
  );
};
