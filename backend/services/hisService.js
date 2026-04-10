import { getHisPool, sql } from "../config/sqlServer.js";
import { ApiError } from "../utils/apiError.js";
import { logger } from "../utils/logger.js";

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 200;
const PHONE_COLUMN_CANDIDATES = [
  "cPat_Mob",
  "cPat_Mobile",
  "cPat_MobileNo",
  "cPhone",
  "cPhoneNo"
];

let cachedPhoneColumn = null;
let lastPhoneLookupAt = 0;
let cachedLookupMeta = null;
let lastLookupMetaAt = 0;

const LOOKUP_TTL_MS = 15 * 60_000;
const QUERY_CACHE_MAX_ENTRIES = 300;
const CACHE_TTL = {
  HIS_PATIENTS: 30 * 1000,
  HIS_SEARCH: 20 * 1000,
  DEMOGRAPHICS: 60 * 1000,
  EXISTS: 45 * 1000
};
const queryCache = new Map();

const DEPT_ID_CANDIDATES = ["iDept_id", "DepartmentID", "iDeptId"];
const DEPT_NAME_CANDIDATES = [
  "cDept_Name",
  "cDeptName",
  "DepartmentName",
  "cDepartment_Name",
  "cDepartmentName",
  "cName"
];
const DEPT_TABLE_CANDIDATES = ["Mast_Dept", "Mast_Department", "Department", "Dept"];

const USER_ID_CANDIDATES = ["iUser_id", "UserID", "iUserId", "iEmp_id", "EmployeeID"];
const USER_NAME_CANDIDATES = [
  "cUser_Name",
  "cUserName",
  "UserName",
  "cEmp_Name",
  "cEmpName",
  "cEmployee_Name",
  "cName"
];
const USER_TABLE_CANDIDATES = ["Mast_User", "Mast_Users", "Mast_Employee", "Mast_Staff", "Users"];

const delay = async (ms = 200) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const getCache = (key = "") => {
  const hit = queryCache.get(key);
  if (!hit) {
    return null;
  }
  if (Date.now() > hit.expiresAt) {
    queryCache.delete(key);
    return null;
  }
  // LRU-ish bump: keep recently used key at end.
  queryCache.delete(key);
  queryCache.set(key, hit);
  return hit.value;
};

const setCache = (key = "", value = null, ttlMs = 15000) => {
  if (!key) {
    return;
  }
  const expiresAt = Date.now() + Math.max(500, Number(ttlMs) || 15000);
  if (queryCache.has(key)) {
    queryCache.delete(key);
  }
  queryCache.set(key, { value, expiresAt });
  if (queryCache.size > QUERY_CACHE_MAX_ENTRIES) {
    const oldestKey = queryCache.keys().next().value;
    if (oldestKey) {
      queryCache.delete(oldestKey);
    }
  }
};

const executeHisQueryWithRetry = async (
  query = "",
  timeoutMs = 10000,
  bindParams = null
) => {
  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    try {
      const pool = await getHisPool();
      const request = pool.request();
      if (typeof bindParams === "function") {
        bindParams(request);
      }
      request.timeout = timeoutMs;
      const result = await request.query(query);
      return result?.recordset ?? [];
    } catch (error) {
      attempt += 1;
      const isLastAttempt = attempt >= MAX_RETRIES;
      logger.error("HIS query failed", {
        attempt,
        message: error?.message ?? "Unknown SQL error"
      });
      if (isLastAttempt) {
        throw new ApiError("Unable to fetch HIS patient data", 503);
      }
      await delay(BASE_BACKOFF_MS * 2 ** (attempt - 1));
    }
  }
  return [];
};

const getPatientPhoneExpression = async () => {
  const now = Date.now();
  if (cachedPhoneColumn !== null && now - lastPhoneLookupAt < 15 * 60_000) {
    return cachedPhoneColumn
      ? `CAST(pm.[${cachedPhoneColumn}] AS VARCHAR(50))`
      : "CAST(NULL AS VARCHAR(50))";
  }
  const query = `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo'
      AND TABLE_NAME = 'Mast_Patient';
  `;
  try {
    const rows = await executeHisQueryWithRetry(query, 10000);
    const columns = rows.map((item) => String(item?.COLUMN_NAME ?? ""));
    cachedPhoneColumn =
      PHONE_COLUMN_CANDIDATES.find((column) => columns.includes(column)) ?? "";
    lastPhoneLookupAt = now;
  } catch {
    cachedPhoneColumn = "";
    lastPhoneLookupAt = now;
  }
  return cachedPhoneColumn
    ? `CAST(pm.[${cachedPhoneColumn}] AS VARCHAR(50))`
    : "CAST(NULL AS VARCHAR(50))";
};

const safeIdent = (identifier = "") => String(identifier ?? "").replaceAll("]", "]]");
const qualifiedTable = (schema = "", table = "") =>
  `[${safeIdent(schema)}].[${safeIdent(table)}]`;

const chooseLookupTable = (tableMap = {}, idCandidates = [], nameCandidates = [], tableHints = []) => {
  const entries = Object.entries(tableMap);
  if (!entries.length) {
    return null;
  }

  let best = null;
  for (const [key, value] of entries) {
    const cols = value?.columns ?? new Set();
    const idCol = idCandidates.find((col) => cols.has(col));
    const nameCol = nameCandidates.find((col) => cols.has(col));
    if (!idCol || !nameCol) {
      continue;
    }

    let score = 10;
    if (idCol === idCandidates[0]) {
      score += 8;
    }
    if (nameCol === nameCandidates[0]) {
      score += 8;
    }
    if (tableHints.some((hint) => value.table.toLowerCase().includes(hint.toLowerCase()))) {
      score += 8;
    }
    if (value.schema.toLowerCase() === "dbo") {
      score += 2;
    }

    if (!best || score > best.score) {
      best = { ...value, idCol, nameCol, score, key };
    }
  }
  return best;
};

const getLookupMeta = async () => {
  const now = Date.now();
  if (cachedLookupMeta !== null && now - lastLookupMetaAt < LOOKUP_TTL_MS) {
    return cachedLookupMeta;
  }

  const candidateColumns = [
    ...new Set([
      ...DEPT_ID_CANDIDATES,
      ...DEPT_NAME_CANDIDATES,
      ...USER_ID_CANDIDATES,
      ...USER_NAME_CANDIDATES
    ])
  ];
  const inList = candidateColumns.map((col) => `'${col}'`).join(", ");
  const query = `
    SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE COLUMN_NAME IN (${inList});
  `;

  try {
    const rows = await executeHisQueryWithRetry(query, 10000);
    const tableMap = {};
    for (const row of rows) {
      const schema = String(row?.TABLE_SCHEMA ?? "");
      const table = String(row?.TABLE_NAME ?? "");
      const column = String(row?.COLUMN_NAME ?? "");
      if (!schema || !table || !column) {
        continue;
      }
      const key = `${schema}.${table}`;
      if (!tableMap[key]) {
        tableMap[key] = { schema, table, columns: new Set() };
      }
      tableMap[key].columns.add(column);
    }

    const dept = chooseLookupTable(
      tableMap,
      DEPT_ID_CANDIDATES,
      DEPT_NAME_CANDIDATES,
      DEPT_TABLE_CANDIDATES
    );
    const user = chooseLookupTable(
      tableMap,
      USER_ID_CANDIDATES,
      USER_NAME_CANDIDATES,
      USER_TABLE_CANDIDATES
    );

    cachedLookupMeta = {
      dept:
        dept == null
          ? null
          : {
              table: qualifiedTable(dept.schema, dept.table),
              idCol: `[${safeIdent(dept.idCol)}]`,
              nameCol: `[${safeIdent(dept.nameCol)}]`
            },
      user:
        user == null
          ? null
          : {
              table: qualifiedTable(user.schema, user.table),
              idCol: `[${safeIdent(user.idCol)}]`,
              nameCol: `[${safeIdent(user.nameCol)}]`
            }
    };
    lastLookupMetaAt = now;
  } catch {
    cachedLookupMeta = { dept: null, user: null };
    lastLookupMetaAt = now;
  }
  return cachedLookupMeta;
};

export const fetchHisPatients = async () => {
  const cacheKey = "his:patients:today";
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }
  const phoneExpr = await getPatientPhoneExpression();
  const query = `
    SELECT
      CAST(pm.iPat_id AS VARCHAR(100)) AS patient_id,
      CAST(op.iOP_Reg_No AS VARCHAR(100)) AS visit_id,
      CAST(pm.cPat_Name AS VARCHAR(200)) AS name,
      ${phoneExpr} AS phone,
      CAST(op.iDept_id AS VARCHAR(100)) AS department,
      'OP' AS type
    FROM [dbo].[Mast_OP_Admission] op
    INNER JOIN [dbo].[Mast_Patient] pm ON op.iPat_id = pm.iPat_id
    WHERE CAST(op.dOP_dt AS DATE) = CAST(GETDATE() AS DATE)
    UNION ALL
    SELECT
      CAST(pm.iPat_id AS VARCHAR(100)) AS patient_id,
      CAST(ip.iIP_Reg_No AS VARCHAR(100)) AS visit_id,
      CAST(pm.cPat_Name AS VARCHAR(200)) AS name,
      ${phoneExpr} AS phone,
      CAST(ip.iDept_id AS VARCHAR(100)) AS department,
      'IP' AS type
    FROM [dbo].[Mast_IP_Admission] ip
    INNER JOIN [dbo].[Mast_Patient] pm ON ip.iPat_id = pm.iPat_id
    WHERE CAST(ip.dIP_dt AS DATE) = CAST(GETDATE() AS DATE)
    ORDER BY department, name;
  `;

  try {
    const patients = await executeHisQueryWithRetry(query, 12000);
    const mapped = patients.map((patient) => ({
      patient_id: String(patient?.patient_id ?? ""),
      visit_id: String(patient?.visit_id ?? ""),
      name: String(patient?.name ?? "Unknown"),
      phone: String(patient?.phone ?? ""),
      department: String(patient?.department ?? "General"),
      type: patient?.type === "IP" ? "IP" : "OP"
    }));
    setCache(cacheKey, mapped, CACHE_TTL.HIS_PATIENTS);
    return mapped;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    logger.error("Unexpected HIS service error", {
      message: error?.message ?? "Unknown error"
    });
    throw new ApiError("Failed to fetch patients", 500);
  }
};

/**
 * Create Token search: optional name, IP/OP reg no, admission date range (ANDed).
 * Returns the same row shape as before.
 *
 * @param {{ name?: string, reg_no?: string, date_from?: string, date_to?: string }} filters
 */
export const searchHisPatients = async (filters = {}) => {
  const name = String(filters.name ?? "").trim();
  const regNo = String(filters.reg_no ?? "").trim();
  const dateFrom = String(filters.date_from ?? "").trim();
  const dateTo = String(filters.date_to ?? "").trim();

  if (!name && !regNo && !dateFrom && !dateTo) {
    return [];
  }
  const cacheKey = `his:search:${JSON.stringify({ name, regNo, dateFrom, dateTo })}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }

  const lookupMeta = await getLookupMeta();
  const deptNameFromOpExpr = lookupMeta?.dept
    ? `(SELECT TOP 1 CAST(lu.${lookupMeta.dept.nameCol} AS VARCHAR(200)) FROM ${lookupMeta.dept.table} lu WHERE CAST(lu.${lookupMeta.dept.idCol} AS VARCHAR(100)) = CAST(op.iDept_id AS VARCHAR(100)))`
    : "CAST(NULL AS VARCHAR(200))";
  const deptNameFromIpExpr = lookupMeta?.dept
    ? `(SELECT TOP 1 CAST(lu.${lookupMeta.dept.nameCol} AS VARCHAR(200)) FROM ${lookupMeta.dept.table} lu WHERE CAST(lu.${lookupMeta.dept.idCol} AS VARCHAR(100)) = CAST(ip.iDept_id AS VARCHAR(100)))`
    : "CAST(NULL AS VARCHAR(200))";
  const userNameExpr = lookupMeta?.user
    ? `(SELECT TOP 1 CAST(uu.${lookupMeta.user.nameCol} AS VARCHAR(200)) FROM ${lookupMeta.user.table} uu WHERE CAST(uu.${lookupMeta.user.idCol} AS VARCHAR(100)) = CAST(pm.iUser_id AS VARCHAR(100)))`
    : "CAST(NULL AS VARCHAR(200))";

  const opConds = [];
  const ipConds = [];

  if (name) {
    opConds.push("pm.cPat_Name LIKE '%' + @name + '%'");
    ipConds.push("pm.cPat_Name LIKE '%' + @name + '%'");
  }
  if (regNo) {
    opConds.push(
      "(CAST(op.iOP_Reg_No AS VARCHAR(100)) LIKE '%' + @regNo + '%' OR CAST(pm.iReg_No AS VARCHAR(100)) LIKE '%' + @regNo + '%')"
    );
    ipConds.push(
      "(CAST(ip.iIP_Reg_No AS VARCHAR(100)) LIKE '%' + @regNo + '%' OR CAST(pm.iReg_No AS VARCHAR(100)) LIKE '%' + @regNo + '%')"
    );
  }
  if (dateFrom) {
    opConds.push("op.dOP_dt >= @dateFrom");
    ipConds.push("ip.dIP_dt >= @dateFrom");
  }
  if (dateTo) {
    opConds.push("op.dOP_dt <= @dateTo");
    ipConds.push("ip.dIP_dt <= @dateTo");
  }

  const opWhere = opConds.length ? `AND ${opConds.join(" AND ")}` : "";
  const ipWhere = ipConds.length ? `AND ${ipConds.join(" AND ")}` : "";

  const opMatchRank = regNo
    ? "CASE WHEN LTRIM(RTRIM(UPPER(CAST(op.iOP_Reg_No AS VARCHAR(100))))) = LTRIM(RTRIM(UPPER(@regNo))) OR LTRIM(RTRIM(UPPER(CAST(pm.iReg_No AS VARCHAR(100))))) = LTRIM(RTRIM(UPPER(@regNo))) THEN 0 ELSE 1 END"
    : "1";
  const ipMatchRank = regNo
    ? "CASE WHEN LTRIM(RTRIM(UPPER(CAST(ip.iIP_Reg_No AS VARCHAR(100))))) = LTRIM(RTRIM(UPPER(@regNo))) OR LTRIM(RTRIM(UPPER(CAST(pm.iReg_No AS VARCHAR(100))))) = LTRIM(RTRIM(UPPER(@regNo))) THEN 0 ELSE 1 END"
    : "1";

  const query = `
    WITH Combined AS (
      SELECT
        CAST(pm.iPat_id AS VARCHAR(100)) AS patient_id,
        CAST(op.iOP_Reg_No AS VARCHAR(100)) AS visit_id,
        CAST(pm.iReg_No AS VARCHAR(100)) AS i_reg_no,
        CAST(pm.cPat_Name AS VARCHAR(200)) AS c_pat_name,
        pm.dDob AS d_dob,
        CAST(pm.cSex AS VARCHAR(20)) AS c_sex,
        CAST(pm.iUser_id AS VARCHAR(100)) AS i_user_id,
        ${userNameExpr} AS i_user_name,
        CAST(op.iDept_id AS VARCHAR(100)) AS dept_id,
        ${deptNameFromOpExpr} AS dept_name,
        op.dOP_dt AS admission,
        CAST(NULL AS VARCHAR(50)) AS ip_active,
        'OP' AS type,
        op.dOP_dt AS visit_datetime,
        ${opMatchRank} AS match_rank
      FROM [dbo].[Mast_OP_Admission] op
      INNER JOIN [dbo].[Mast_Patient] pm ON op.iPat_id = pm.iPat_id
      WHERE 1 = 1
      ${opWhere}

      UNION ALL

      SELECT
        CAST(pm.iPat_id AS VARCHAR(100)) AS patient_id,
        CAST(ip.iIP_Reg_No AS VARCHAR(100)) AS visit_id,
        CAST(pm.iReg_No AS VARCHAR(100)) AS i_reg_no,
        CAST(pm.cPat_Name AS VARCHAR(200)) AS c_pat_name,
        pm.dDob AS d_dob,
        CAST(pm.cSex AS VARCHAR(20)) AS c_sex,
        CAST(pm.iUser_id AS VARCHAR(100)) AS i_user_id,
        ${userNameExpr} AS i_user_name,
        CAST(ip.iDept_id AS VARCHAR(100)) AS dept_id,
        ${deptNameFromIpExpr} AS dept_name,
        ip.dIP_dt AS admission,
        CAST(ip.bStatus AS VARCHAR(50)) AS ip_active,
        'IP' AS type,
        ip.dIP_dt AS visit_datetime,
        ${ipMatchRank} AS match_rank
      FROM [dbo].[Mast_IP_Admission] ip
      INNER JOIN [dbo].[Mast_Patient] pm ON ip.iPat_id = pm.iPat_id
      WHERE 1 = 1
      ${ipWhere}
    )
    SELECT TOP 50
      patient_id,
      visit_id,
      i_reg_no,
      c_pat_name,
      d_dob,
      c_sex,
      i_user_id,
      i_user_name,
      dept_id,
      dept_name,
      admission,
      ip_active,
      type,
      visit_datetime
    FROM Combined
    ORDER BY match_rank ASC, visit_datetime DESC;
  `;

  const bindParams = (request) => {
    if (name) {
      request.input("name", sql.NVarChar(500), name);
    }
    if (regNo) {
      request.input("regNo", sql.NVarChar(200), regNo);
    }
    if (dateFrom) {
      request.input("dateFrom", sql.DateTime, new Date(`${dateFrom}T00:00:00`));
    }
    if (dateTo) {
      request.input("dateTo", sql.DateTime, new Date(`${dateTo}T23:59:59.997`));
    }
  };

  try {
    const rows = await executeHisQueryWithRetry(query, 12000, bindParams);
    const fmtDate = (v) => {
      if (v == null || v === "") {
        return "";
      }
      const d = v instanceof Date ? v : new Date(v);
      return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
    };
    const fmtDateTime = (v) => {
      if (v == null || v === "") {
        return "";
      }
      const d = v instanceof Date ? v : new Date(v);
      return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 19).replace("T", " ");
    };
    const mapped = rows.map((item) => {
      const type = item?.type === "IP" ? "IP" : "OP";
      const dept = String(item?.dept_id ?? "");
      const name = String(item?.c_pat_name ?? "Unknown");
      return {
        patient_id: String(item?.patient_id ?? ""),
        visit_id: String(item?.visit_id ?? ""),
        type,
        reg_no: String(item?.visit_id ?? ""),
        i_reg_no: String(item?.i_reg_no ?? ""),
        c_pat_name: name,
        d_dob: fmtDate(item?.d_dob),
        c_sex: String(item?.c_sex ?? "").trim(),
        i_user_id: String(item?.i_user_id ?? ""),
        i_user_name: String(item?.i_user_name ?? "").trim(),
        dept_id: dept,
        dept_name: String(item?.dept_name ?? "").trim(),
        admission: fmtDateTime(item?.admission),
        ip_active:
          type === "IP" && item?.ip_active != null && item?.ip_active !== ""
            ? String(item.ip_active)
            : "",
        name,
        department: String(item?.dept_name ?? "").trim() || dept
      };
    });
    setCache(cacheKey, mapped, CACHE_TTL.HIS_SEARCH);
    return mapped;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    logger.error("HIS patient search failed", {
      message: error?.message ?? "Unknown SQL error"
    });
    throw new ApiError("Unable to search patients", 503);
  }
};

export const fetchPatientDemographics = async (patientIds = []) => {
  const normalized = [...new Set(patientIds.map((id) => String(id ?? "").trim()))].filter(
    Boolean
  );
  if (!normalized.length) {
    return {};
  }
  const cacheKey = `his:demo:${normalized.join(",")}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }
  const phoneExpr = await getPatientPhoneExpression();
  const params = normalized.map((_item, index) => `@p${index}`);
  const query = `
    SELECT
      CAST(pm.iPat_id AS VARCHAR(100)) AS patient_id,
      CAST(pm.cPat_Name AS VARCHAR(200)) AS name,
      ${phoneExpr} AS phone
    FROM [dbo].[Mast_Patient] pm
    WHERE CAST(pm.iPat_id AS VARCHAR(100)) IN (${params.join(", ")});
  `;
  try {
    const rows = await executeHisQueryWithRetry(query, 12000, (request) => {
      normalized.forEach((id, index) => {
        request.input(`p${index}`, sql.VarChar, id);
      });
    });
    const mapped = rows.reduce((acc, row) => {
      const key = String(row?.patient_id ?? "");
      acc[key] = {
        name: String(row?.name ?? "Unknown"),
        phone: String(row?.phone ?? "")
      };
      return acc;
    }, {});
    setCache(cacheKey, mapped, CACHE_TTL.DEMOGRAPHICS);
    return mapped;
  } catch (error) {
    logger.error("Failed to fetch patient demographics", {
      message: error?.message ?? "Unknown SQL error"
    });
    return {};
  }
};

export const checkPatientExistsInHis = async (patientId = "", visitId = "") => {
  const id = String(patientId ?? "").trim();
  const visit = String(visitId ?? "").trim();
  const cacheKey = `his:exists:${id}:${visit}`;
  const cached = getCache(cacheKey);
  if (typeof cached === "boolean") {
    return cached;
  }
  const query = `
    SELECT TOP 1 patient_id, visit_id FROM (
      SELECT CAST(pm.iPat_id AS VARCHAR(100)) AS patient_id, CAST(op.iOP_Reg_No AS VARCHAR(100)) AS visit_id
      FROM [dbo].[Mast_OP_Admission] op
      INNER JOIN [dbo].[Mast_Patient] pm ON op.iPat_id = pm.iPat_id
      UNION ALL
      SELECT CAST(pm.iPat_id AS VARCHAR(100)) AS patient_id, CAST(ip.iIP_Reg_No AS VARCHAR(100)) AS visit_id
      FROM [dbo].[Mast_IP_Admission] ip
      INNER JOIN [dbo].[Mast_Patient] pm ON ip.iPat_id = pm.iPat_id
    ) p
    WHERE p.patient_id = @patientId AND p.visit_id = @visitId;
  `;

  try {
    const pool = await getHisPool();
    const request = pool.request();
    request.input("patientId", sql.VarChar, id);
    request.input("visitId", sql.VarChar, visit);
    request.timeout = 10000;
    const result = await request.query(query);
    const exists = (result?.recordset?.length ?? 0) > 0;
    setCache(cacheKey, exists, CACHE_TTL.EXISTS);
    return exists;
  } catch (error) {
    logger.error("Failed patient existence check in HIS", {
      message: error?.message ?? "Unknown SQL error"
    });
    throw new ApiError("Unable to verify patient in HIS", 503);
  }
};
