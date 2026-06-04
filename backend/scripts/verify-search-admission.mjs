import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { sqlAdmissionDisplayExpr } from "../utils/hospitalDateTime.js";
import { getHisPool, sql } from "../config/sqlServer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const pool = await getHisPool();
const r = await pool
  .request()
  .input("regNo", sql.NVarChar(200), "6076041")
  .query(`
    SELECT
      CAST(ip.iIP_Reg_No AS VARCHAR(100)) AS visit_id,
      CAST(pm.cPat_Name AS VARCHAR(200)) AS name,
      CONVERT(VARCHAR(23), ip.dIP_dt, 121) AS raw_sql_column,
      ${sqlAdmissionDisplayExpr("ip.dIP_dt")} AS admission_for_ui,
      CASE WHEN ip.dIP_dt > GETDATE() THEN 'HIDE' ELSE 'SHOW' END AS sql_check
    FROM dbo.Mast_IP_Admission ip
    INNER JOIN dbo.Mast_Patient pm ON ip.iPat_id = pm.iPat_id
    WHERE CAST(ip.iIP_Reg_No AS VARCHAR(100)) = 'IP07012055'
  `);

console.log(r.recordset[0]);
process.exit(0);
