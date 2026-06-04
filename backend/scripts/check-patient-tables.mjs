import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getHisPool } from "../config/sqlServer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const pool = await getHisPool();

const tables = await pool.request().query(`
  SELECT TABLE_SCHEMA, TABLE_NAME
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_TYPE = 'BASE TABLE'
    AND (
      TABLE_NAME LIKE '%Patient%'
      OR TABLE_NAME LIKE '%patient%'
      OR TABLE_NAME LIKE 'Z%'
    )
  ORDER BY TABLE_NAME
`);
console.log("Patient/Z tables:");
console.log(JSON.stringify(tables.recordset, null, 2));

const cols = await pool.request().query(`
  SELECT COLUMN_NAME, DATA_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Mast_Patient'
  ORDER BY ORDINAL_POSITION
`);
console.log("\nMast_Patient columns:");
for (const row of cols.recordset ?? []) {
  console.log(`  ${row.COLUMN_NAME} (${row.DATA_TYPE})`);
}

process.exit(0);
