import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getHisPool, sql } from "../config/sqlServer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const pool = await getHisPool();

const today = await pool.request().query(`
  SELECT TOP 10
    CAST(ip.iIP_Reg_No AS VARCHAR(100)) AS visit_id,
    CONVERT(VARCHAR(23), ip.dIP_dt, 121) AS admission_sql,
    CONVERT(VARCHAR(23), GETDATE(), 121) AS sql_now,
    CASE WHEN ip.dIP_dt > GETDATE() THEN 'FUTURE' ELSE 'OK' END AS check_status
  FROM dbo.Mast_IP_Admission ip
  WHERE CAST(ip.dIP_dt AS DATE) = CAST(GETDATE() AS DATE)
  ORDER BY ip.dIP_dt DESC
`);

console.log("Today's IP admissions (SQL check):");
console.table(today.recordset);

const visit = await pool.request().input("v", sql.VarChar(50), "IP07012055").query(`
  SELECT
    CAST(ip.iIP_Reg_No AS VARCHAR(100)) AS visit_id,
    ip.dIP_dt,
    CONVERT(VARCHAR(23), ip.dIP_dt, 121) AS admission_sql,
    CONVERT(VARCHAR(23), GETDATE(), 121) AS sql_now,
    CASE WHEN ip.dIP_dt > GETDATE() THEN 'FUTURE' ELSE 'OK' END AS check_status
  FROM dbo.Mast_IP_Admission ip
  WHERE CAST(ip.iIP_Reg_No AS VARCHAR(100)) = @v
`);

console.log("\nIP07012055:");
console.log(visit.recordset[0]);

process.exit(0);
