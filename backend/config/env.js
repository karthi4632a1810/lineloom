import dotenv from "dotenv";

dotenv.config();

const parseBoolean = (value, fallback = false) => {
  if (value == null) {
    return fallback;
  }
  return String(value).toLowerCase() === "true";
};

export const env = {
  /** When false, HIS/SQL Server is never contacted (empty search, no pool connect). Default true. */
  hisEnabled: parseBoolean(process.env.HIS_ENABLED, true),
  port: Number(process.env.PORT ?? 5000),
  mongoUri:
    process.env.MONGO_URI ??
    "mongodb://127.0.0.1:27017/patient_waiting_tracker",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  hisSql: {
    host: process.env.HIS_SQL_HOST ?? process.env.OP_IP_DB_SERVER ?? "localhost",
    port: Number(process.env.HIS_SQL_PORT ?? 1433),
    database:
      process.env.HIS_SQL_DATABASE ?? process.env.OP_IP_DB_NAME ?? "KMCH_Frontoffice",
    user: process.env.HIS_SQL_USER ?? process.env.OP_IP_DB_USER ?? "readonly_user",
    password:
      process.env.HIS_SQL_PASSWORD ?? process.env.OP_IP_DB_PASS ?? "readonly_password",
    encrypt: parseBoolean(process.env.HIS_SQL_ENCRYPT, true),
    trustServerCertificate: parseBoolean(process.env.HIS_SQL_TRUST_CERT, true)
  },
  /** KMCH_Billing (Web.config BB_CONSTR) — Astil_BillDetailReportOP_QB */
  billingSql: {
    host:
      process.env.BILLING_SQL_HOST ??
      process.env.HIS_SQL_HOST ??
      process.env.OP_IP_DB_SERVER ??
      "localhost",
    port: Number(process.env.BILLING_SQL_PORT ?? process.env.HIS_SQL_PORT ?? 1433),
    database: process.env.BILLING_SQL_DATABASE ?? "KMCH_Billing",
    user:
      process.env.BILLING_SQL_USER ??
      process.env.HIS_SQL_USER ??
      process.env.OP_IP_DB_USER ??
      "readonly_user",
    password:
      process.env.BILLING_SQL_PASSWORD ??
      process.env.HIS_SQL_PASSWORD ??
      process.env.OP_IP_DB_PASS ??
      "readonly_password",
    encrypt: parseBoolean(process.env.BILLING_SQL_ENCRYPT ?? process.env.HIS_SQL_ENCRYPT, true),
    trustServerCertificate: parseBoolean(
      process.env.BILLING_SQL_TRUST_CERT ?? process.env.HIS_SQL_TRUST_CERT,
      true
    )
  },
  billingSessionCompanyId: String(process.env.BILLING_SESSION_COMPANY_ID ?? "1").trim() || "1",
  /** KMCH_Lab (Web.config BB_CONSTR) — LabTestResultHistoryQB */
  labSql: {
    host:
      process.env.LAB_SQL_HOST ??
      process.env.HIS_SQL_HOST ??
      process.env.OP_IP_DB_SERVER ??
      "localhost",
    port: Number(process.env.LAB_SQL_PORT ?? process.env.HIS_SQL_PORT ?? 1433),
    database: process.env.LAB_SQL_DATABASE ?? "KMCH_Lab",
    user:
      process.env.LAB_SQL_USER ??
      process.env.HIS_SQL_USER ??
      process.env.OP_IP_DB_USER ??
      "readonly_user",
    password:
      process.env.LAB_SQL_PASSWORD ??
      process.env.HIS_SQL_PASSWORD ??
      process.env.OP_IP_DB_PASS ??
      "readonly_password",
    encrypt: parseBoolean(process.env.LAB_SQL_ENCRYPT ?? process.env.HIS_SQL_ENCRYPT, true),
    trustServerCertificate: parseBoolean(
      process.env.LAB_SQL_TRUST_CERT ?? process.env.HIS_SQL_TRUST_CERT,
      true
    )
  },
  /** KMCH_Pharmacy (Web.config BB_CONSTR) — Pharm_Rpt_Sales_Details_QB */
  pharmacySql: {
    host:
      process.env.PHARMACY_SQL_HOST ??
      process.env.HIS_SQL_HOST ??
      process.env.OP_IP_DB_SERVER ??
      "localhost",
    port: Number(process.env.PHARMACY_SQL_PORT ?? process.env.HIS_SQL_PORT ?? 1433),
    database: process.env.PHARMACY_SQL_DATABASE ?? "KMCH_Pharmacy",
    user:
      process.env.PHARMACY_SQL_USER ??
      process.env.HIS_SQL_USER ??
      process.env.OP_IP_DB_USER ??
      "readonly_user",
    password:
      process.env.PHARMACY_SQL_PASSWORD ??
      process.env.HIS_SQL_PASSWORD ??
      process.env.OP_IP_DB_PASS ??
      "readonly_password",
    encrypt: parseBoolean(process.env.PHARMACY_SQL_ENCRYPT ?? process.env.HIS_SQL_ENCRYPT, true),
    trustServerCertificate: parseBoolean(
      process.env.PHARMACY_SQL_TRUST_CERT ?? process.env.HIS_SQL_TRUST_CERT,
      true
    )
  },
  pharmacyStrId: String(process.env.PHARMACY_STR_ID ?? "6").trim() || "6",
  pharmacyReportOpt: String(process.env.PHARMACY_REPORT_OPT ?? "3").trim() || "3",
  /** SQL request timeout (ms) for lab / pharmacy / billing stored procedures. */
  hisQueryTimeoutMs: Number(process.env.HIS_QUERY_TIMEOUT_MS ?? 20_000),
  /** In-memory cache TTL (ms) for identical HIS lookups on token detail / poll. */
  hisCacheTtlMs: Number(process.env.HIS_CACHE_TTL_MS ?? 45_000)
};
