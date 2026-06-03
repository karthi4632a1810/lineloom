import dotenv from "dotenv";
import sql from "mssql";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const host = process.env.OP_IP_DB_SERVER ?? process.env.HIS_SQL_HOST;
const user = process.env.OP_IP_DB_USER ?? process.env.HIS_SQL_USER;
const password = process.env.OP_IP_DB_PASS ?? process.env.HIS_SQL_PASSWORD;

const databases = [
  process.env.PHARMACY_SQL_DATABASE ?? "KMCH_Pharmacy",
  process.env.BILLING_SQL_DATABASE ?? "KMCH_Billing",
  process.env.LAB_SQL_DATABASE ?? "KMCH_Lab",
  process.env.OP_IP_DB_NAME ?? "KMCH_Frontoffice",
  "KMCH_Pharmacy",
  "KMCH_Billing",
  "KMCH_Lab",
  "KMCH_Frontoffice"
];

const patterns = ["Pharm_Rpt%", "Astil_Bill%", "LabTest%"];

const baseConfig = {
  server: host,
  port: Number(process.env.HIS_SQL_PORT ?? 1433),
  user,
  password,
  options: {
    encrypt: String(process.env.HIS_SQL_ENCRYPT ?? "true").toLowerCase() === "true",
    trustServerCertificate: String(process.env.HIS_SQL_TRUST_CERT ?? "true").toLowerCase() === "true"
  }
};

console.log("Server:", host);

for (const database of [...new Set(databases.filter(Boolean))]) {
  let pool;
  try {
    pool = await sql.connect({ ...baseConfig, database });
    const exact = await pool.request().query(`
      SELECT SCHEMA_NAME(schema_id) AS schema_name, name
      FROM sys.procedures
      WHERE name IN (
        'Pharm_Rpt_Sales_Details_QB',
        'Astil_BillDetailReportOP_QB',
        'LabTestResultHistoryQB'
      )
      ORDER BY name;
    `);
    const like = await pool.request().query(`
      SELECT SCHEMA_NAME(schema_id) AS schema_name, name
      FROM sys.procedures
      WHERE name LIKE 'Pharm_Rpt%'
         OR name LIKE 'Astil_Bill%'
         OR name LIKE 'LabTest%'
      ORDER BY name;
    `);
    console.log(`\n[${database}]`);
    if (exact.recordset?.length) {
      console.log("  Exact matches:");
      for (const row of exact.recordset) {
        console.log(`    ${row.schema_name}.${row.name}`);
      }
    } else {
      console.log("  Exact matches: (none)");
    }
    if (like.recordset?.length) {
      console.log("  Similar:");
      for (const row of like.recordset) {
        console.log(`    ${row.schema_name}.${row.name}`);
      }
    } else {
      console.log("  Similar: (none)");
    }
    await pool.close();
  } catch (error) {
    console.log(`\n[${database}] ERROR: ${error.message}`);
    try {
      await pool?.close();
    } catch {
      /* ignore */
    }
  }
}
