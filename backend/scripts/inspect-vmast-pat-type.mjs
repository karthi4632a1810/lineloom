import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getHisPool } from "../config/sqlServer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const pool = await getHisPool();

for (const view of ["vMastPatientType", "vPatientTypewiseList"]) {
  try {
    const cols = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${view}' ORDER BY ORDINAL_POSITION
    `);
    console.log(`\n${view} columns:`, cols.recordset.map((r) => r.COLUMN_NAME).join(", "));
    const rows = await pool.request().query(`SELECT TOP 50 * FROM dbo.${view}`);
    console.table(rows.recordset);
  } catch (e) {
    console.log(`${view}:`, e.message);
  }
}

const type62 = await pool.request().query(`
  SELECT * FROM dbo.vMastPatientType WHERE iPat_type_id = 62 OR iPat_Type_id = 62
`).catch(() => null);

if (type62?.recordset?.[0]) {
  console.log("\nType 62 from view:", type62.recordset[0]);
}

const allTypes = await pool.request().query(`
  SELECT TOP 100 * FROM dbo.vMastPatientType
`);
console.log("\nvMastPatientType all:");
console.table(allTypes.recordset);

process.exit(0);
