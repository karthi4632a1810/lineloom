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

const delay = async (ms = 200) =>
  new Promise((resolve) => setTimeout(resolve, ms));

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

export const fetchHisPatients = async () => {
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
    return patients.map((patient) => ({
      patient_id: String(patient?.patient_id ?? ""),
      visit_id: String(patient?.visit_id ?? ""),
      name: String(patient?.name ?? "Unknown"),
      phone: String(patient?.phone ?? ""),
      department: String(patient?.department ?? "General"),
      type: patient?.type === "IP" ? "IP" : "OP"
    }));
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

export const searchHisPatients = async (searchTerm = "") => {
  const search = String(searchTerm ?? "").trim();
  const phoneExpr = await getPatientPhoneExpression();
  const query = `
    SELECT TOP 50
      CAST(pm.iPat_id AS VARCHAR(100)) AS patient_id,
      CAST(op.iOP_Reg_No AS VARCHAR(100)) AS visit_id,
      CAST(pm.cPat_Name AS VARCHAR(200)) AS name,
      ${phoneExpr} AS phone,
      CAST(op.iDept_id AS VARCHAR(100)) AS department,
      'OP' AS type,
      op.dOP_dt AS visit_datetime
    FROM [dbo].[Mast_OP_Admission] op
    INNER JOIN [dbo].[Mast_Patient] pm ON op.iPat_id = pm.iPat_id
    WHERE @search = ''
       OR CAST(pm.iPat_id AS VARCHAR(100)) LIKE '%' + @search + '%'
       OR CAST(op.iOP_Reg_No AS VARCHAR(100)) LIKE '%' + @search + '%'
       OR pm.cPat_Name LIKE '%' + @search + '%'
    UNION ALL
    SELECT TOP 50
      CAST(pm.iPat_id AS VARCHAR(100)) AS patient_id,
      CAST(ip.iIP_Reg_No AS VARCHAR(100)) AS visit_id,
      CAST(pm.cPat_Name AS VARCHAR(200)) AS name,
      ${phoneExpr} AS phone,
      CAST(ip.iDept_id AS VARCHAR(100)) AS department,
      'IP' AS type,
      ip.dIP_dt AS visit_datetime
    FROM [dbo].[Mast_IP_Admission] ip
    INNER JOIN [dbo].[Mast_Patient] pm ON ip.iPat_id = pm.iPat_id
    WHERE @search = ''
       OR CAST(pm.iPat_id AS VARCHAR(100)) LIKE '%' + @search + '%'
       OR CAST(ip.iIP_Reg_No AS VARCHAR(100)) LIKE '%' + @search + '%'
       OR pm.cPat_Name LIKE '%' + @search + '%'
    ORDER BY visit_datetime DESC;
  `;
  try {
    const rows = await executeHisQueryWithRetry(query, 12000, (request) => {
      request.input("search", sql.VarChar, search);
    });
    return rows.map((item) => ({
      patient_id: String(item?.patient_id ?? ""),
      visit_id: String(item?.visit_id ?? ""),
      name: String(item?.name ?? "Unknown"),
      phone: String(item?.phone ?? ""),
      department: String(item?.department ?? "General"),
      type: item?.type === "IP" ? "IP" : "OP"
    }));
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
    return rows.reduce((acc, row) => {
      const key = String(row?.patient_id ?? "");
      acc[key] = {
        name: String(row?.name ?? "Unknown"),
        phone: String(row?.phone ?? "")
      };
      return acc;
    }, {});
  } catch (error) {
    logger.error("Failed to fetch patient demographics", {
      message: error?.message ?? "Unknown SQL error"
    });
    return {};
  }
};

export const checkPatientExistsInHis = async (patientId = "", visitId = "") => {
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
    request.input("patientId", sql.VarChar, patientId);
    request.input("visitId", sql.VarChar, visitId);
    request.timeout = 10000;
    const result = await request.query(query);
    return (result?.recordset?.length ?? 0) > 0;
  } catch (error) {
    logger.error("Failed patient existence check in HIS", {
      message: error?.message ?? "Unknown SQL error"
    });
    throw new ApiError("Unable to verify patient in HIS", 503);
  }
};
