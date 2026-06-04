import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getHisPool, sql } from "../config/sqlServer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const pool = await getHisPool();

const patient = await pool.request().input("reg", sql.VarChar(50), "6076041").query(`
  SELECT TOP 5
    pm.iPat_id,
    pm.iReg_No,
    pm.cPat_Name,
    pm.iPat_Type_id,
    pm.iCorp_id,
    pm.bActive,
    pm.iTemp_Pat_Id,
    pm.cPat_Remarks,
    pm.cPrefix_RegNo,
    pm.isVIP,
    pm.iUser_id
  FROM dbo.Mast_Patient pm
  WHERE CAST(pm.iReg_No AS VARCHAR(100)) LIKE '%6076041%'
     OR pm.cPat_Name LIKE '%Shanthanam%'
`);

console.log("Patient rows:");
console.table(patient.recordset);

const typeTables = await pool.request().query(`
  SELECT TABLE_NAME
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME LIKE '%Pat_Type%' OR TABLE_NAME LIKE '%Patient_Type%'
  ORDER BY TABLE_NAME
`);
console.log("\nPat type tables:", typeTables.recordset.map((r) => r.TABLE_NAME));

const type62 = await pool.request().query(`
  SELECT TOP 20 *
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME LIKE '%Pat%Type%' AND TABLE_SCHEMA = 'dbo'
`);
console.log("\nColumns on pat type tables (sample):", type62.recordset.slice(0, 15));

process.exit(0);
