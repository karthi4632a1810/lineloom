import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getHisPool } from "../config/sqlServer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const pool = await getHisPool();

const tables = await pool.request().query(`
  SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME LIKE '%IP%Pat%Type%' OR TABLE_NAME LIKE '%Pat%Type%'
  ORDER BY TABLE_NAME
`);
console.log("Pat type related tables:", tables.recordset.map((r) => r.TABLE_NAME).slice(0, 30));

const shan = await pool.request().query(`
  SELECT
    CAST(ip.iIP_Reg_No AS VARCHAR(100)) AS visit_id,
    pm.cPat_Name,
    pm.iPat_Type_id AS mast_pat_type,
    ip.iIP_Pat_Type_Id,
    ip.iCaseType_Id
  FROM dbo.Mast_IP_Admission ip
  INNER JOIN dbo.Mast_Patient pm ON ip.iPat_id = pm.iPat_id
  WHERE CAST(ip.iIP_Reg_No AS VARCHAR(100)) = 'IP07012055'
`);
console.log("\nShanthanam:");
console.log(shan.recordset[0]);

const dist = await pool.request().query(`
  SELECT ip.iIP_Pat_Type_Id, COUNT(*) cnt
  FROM dbo.Mast_IP_Admission ip
  WHERE CAST(ip.dIP_dt AS DATE) = CAST(GETDATE() AS DATE)
  GROUP BY ip.iIP_Pat_Type_Id
  ORDER BY cnt DESC
`);
console.log("\nToday IP by iIP_Pat_Type_Id:");
console.table(dist.recordset);

try {
  const mastIpPatType = await pool.request().query(`SELECT TOP 30 * FROM dbo.Mast_IP_Pat_Type ORDER BY 1`);
  console.log("\nMast_IP_Pat_Type:");
  console.table(mastIpPatType.recordset);
} catch (e) {
  console.log("Mast_IP_Pat_Type error:", e.message);
}

process.exit(0);
