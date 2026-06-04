import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getHisPool, sql } from "../config/sqlServer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const pool = await getHisPool();

const cols = await pool.request().query(`
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'Mast_Pat_Type' ORDER BY ORDINAL_POSITION
`);
console.log("Mast_Pat_Type columns:", cols.recordset.map((r) => r.COLUMN_NAME).join(", "));

const exact = await pool.request().query(`
  SELECT
    pm.iPat_id,
    pm.iReg_No,
    pm.cPat_Name,
    pm.iPat_Type_id,
    pt.*,
    pm.iCorp_id,
    pm.iTemp_Pat_Id,
    pm.cPat_Remarks
  FROM dbo.Mast_Patient pm
  LEFT JOIN dbo.Mast_Pat_Type pt ON pm.iPat_Type_id = pt.iPat_Type_id
  WHERE CAST(pm.iReg_No AS VARCHAR(100)) = '6076041'
`);

console.log("\n6076041 patient:");
console.log(exact.recordset[0]);

const patTypes = await pool.request().query(`SELECT * FROM dbo.Mast_Pat_Type ORDER BY iPat_type_id`);
console.log("\nAll Mast_Pat_Type (count):", patTypes.recordset.length);
if (patTypes.recordset[0]) {
  console.table(patTypes.recordset);
}

const dist = await pool.request().query(`
  SELECT iPat_Type_id, COUNT(*) AS cnt
  FROM dbo.Mast_Patient
  GROUP BY iPat_Type_id
  ORDER BY cnt DESC
`);
console.log("\nPatient type distribution:");
console.table(dist.recordset);

const todayOp = await pool.request().query(`
  SELECT pm.iPat_Type_id, COUNT(*) cnt
  FROM dbo.Mast_OP_Admission op
  INNER JOIN dbo.Mast_Patient pm ON op.iPat_id = pm.iPat_id
  WHERE CAST(op.dOP_dt AS DATE) = CAST(GETDATE() AS DATE)
  GROUP BY pm.iPat_Type_id
`);
console.log("\nToday OP by iPat_Type_id:");
console.table(todayOp.recordset);

const zTables = await pool.request().query(`
  SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME LIKE '%Z%Pat%' OR TABLE_NAME LIKE '%Pat%Z%' OR TABLE_NAME LIKE '%Mock%'
  ORDER BY TABLE_NAME
`);
console.log("\nZ/Mock tables:", zTables.recordset.map((r) => r.TABLE_NAME));

process.exit(0);
