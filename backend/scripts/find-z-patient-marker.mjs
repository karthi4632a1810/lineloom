import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getHisPool } from "../config/sqlServer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const pool = await getHisPool();

const ip = await pool.request().query(`
  SELECT COLUMN_NAME, DATA_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'Mast_IP_Admission'
    AND (
      COLUMN_NAME LIKE '%Z%'
      OR COLUMN_NAME LIKE '%mock%'
      OR COLUMN_NAME LIKE '%test%'
      OR COLUMN_NAME LIKE '%type%'
      OR COLUMN_NAME LIKE '%status%'
      OR COLUMN_NAME LIKE '%flag%'
    )
  ORDER BY COLUMN_NAME
`);
console.log("Mast_IP_Admission flag-like columns:");
console.table(ip.recordset);

const row = await pool.request().query(`
  SELECT TOP 1 ip.*
  FROM dbo.Mast_IP_Admission ip
  INNER JOIN dbo.Mast_Patient pm ON ip.iPat_id = pm.iPat_id
  WHERE CAST(ip.iIP_Reg_No AS VARCHAR(100)) = 'IP07012055'
`);
console.log("\nIP07012055 full IP row keys:", Object.keys(row.recordset[0] ?? {}).sort().join(", "));

const compare = await pool.request().query(`
  SELECT TOP 3
    CAST(ip.iIP_Reg_No AS VARCHAR(100)) AS visit_id,
    pm.cPat_Name,
    pm.iPat_Type_id,
    pm.iCorp_id,
    ip.bStatus
  FROM dbo.Mast_IP_Admission ip
  INNER JOIN dbo.Mast_Patient pm ON ip.iPat_id = pm.iPat_id
  WHERE CAST(ip.dIP_dt AS DATE) = CAST(GETDATE() AS DATE)
    AND pm.iPat_Type_id = 1
  ORDER BY ip.dIP_dt DESC
`);
console.log("\nSample type-1 IP today:");
console.table(compare.recordset);

const compare62 = await pool.request().query(`
  SELECT TOP 3
    CAST(ip.iIP_Reg_No AS VARCHAR(100)) AS visit_id,
    pm.cPat_Name,
    pm.iPat_Type_id,
    pm.iCorp_id,
    ip.bStatus
  FROM dbo.Mast_IP_Admission ip
  INNER JOIN dbo.Mast_Patient pm ON ip.iPat_id = pm.iPat_id
  WHERE CAST(ip.dIP_dt AS DATE) = CAST(GETDATE() AS DATE)
    AND pm.iPat_Type_id = 62
  ORDER BY ip.dIP_dt DESC
`);
console.log("\nSample type-62 IP today:");
console.table(compare62.recordset);

process.exit(0);
