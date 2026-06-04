import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getHisPool } from "../config/sqlServer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const pool = await getHisPool();

const flags = await pool.request().query(`
  SELECT
    'mock' AS label,
    pm.iPat_id,
    pm.iReg_No,
    pm.cPat_Name,
    pm.iPat_Type_id,
    pm.iCorp_id,
    pm.iTemp_Pat_Id,
    pm.cPrefix_RegNo,
    pm.bEMR_Pat_Track,
    ip.iIP_Pat_Type_Id,
    ip.bER_Patient,
    ip.bDay_Care,
    ip.iSource_Id
  FROM dbo.Mast_IP_Admission ip
  INNER JOIN dbo.Mast_Patient pm ON ip.iPat_id = pm.iPat_id
  WHERE CAST(ip.iIP_Reg_No AS VARCHAR(100)) = 'IP07012055'

  UNION ALL

  SELECT
    'normal' AS label,
    pm.iPat_id,
    pm.iReg_No,
    pm.cPat_Name,
    pm.iPat_Type_id,
    pm.iCorp_id,
    pm.iTemp_Pat_Id,
    pm.cPrefix_RegNo,
    pm.bEMR_Pat_Track,
    ip.iIP_Pat_Type_Id,
    ip.bER_Patient,
    ip.bDay_Care,
    ip.iSource_Id
  FROM dbo.Mast_IP_Admission ip
  INNER JOIN dbo.Mast_Patient pm ON ip.iPat_id = pm.iPat_id
  WHERE CAST(ip.dIP_dt AS DATE) = CAST(GETDATE() AS DATE)
    AND pm.iPat_Type_id = 1
    AND ip.dIP_dt <= GETDATE()
  ORDER BY label
`);
console.table(flags.recordset);

const temp = await pool.request().query(`
  SELECT COUNT(*) cnt FROM dbo.Mast_Patient_Temp WHERE iPat_id = 5146191
`).catch((e) => ({ recordset: [{ cnt: e.message }] }));
console.log("Mast_Patient_Temp:", temp.recordset[0]);

const searchZ = await pool.request().query(`
  SELECT TABLE_NAME, COLUMN_NAME
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE COLUMN_NAME LIKE '%Z%Pat%'
     OR COLUMN_NAME LIKE '%Mock%'
     OR COLUMN_NAME = 'bZPatient'
     OR COLUMN_NAME = 'isZPatient'
  ORDER BY TABLE_NAME
`);
console.log("\nZ-related columns in schema:");
console.table(searchZ.recordset.slice(0, 30));

process.exit(0);
