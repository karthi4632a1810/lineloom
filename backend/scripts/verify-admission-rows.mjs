import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getHisPool, sql } from "../config/sqlServer.js";
import { sqlDateTimeExpr } from "../utils/hospitalDateTime.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const checks = [
  { iReg_No: "6076181", visit: "6199042", name: "ANUSHAYA" },
  { iReg_No: "6033655", visit: "6199041", name: "PACHIYAMMAL" }
];

const pool = await getHisPool();

const now = await pool.request().query(`
  SELECT CONVERT(VARCHAR(23), GETDATE(), 121) AS sql_now
`);
console.log("SQL GETDATE():", now.recordset[0]?.sql_now);
console.log("");

for (const c of checks) {
  const r = await pool
    .request()
    .input("reg", sql.VarChar(50), c.iReg_No)
    .input("visit", sql.VarChar(50), c.visit)
    .query(`
      SELECT
        CAST(pm.iReg_No AS VARCHAR(100)) AS i_reg_no,
        CAST(pm.cPat_Name AS VARCHAR(200)) AS c_pat_name,
        CAST(op.iOP_Reg_No AS VARCHAR(100)) AS visit_id,
        op.dOP_dt AS raw_dOP_dt,
        ${sqlDateTimeExpr("op.dOP_dt")} AS admission_sql_121,
        CONVERT(VARCHAR(30), op.dOP_dt, 109) AS admission_109,
        CASE WHEN op.dOP_dt > GETDATE() THEN 'FUTURE' ELSE 'OK' END AS time_check,
        pm.iUser_id
      FROM dbo.Mast_OP_Admission op
      INNER JOIN dbo.Mast_Patient pm ON op.iPat_id = pm.iPat_id
      WHERE CAST(pm.iReg_No AS VARCHAR(100)) = @reg
        AND CAST(op.iOP_Reg_No AS VARCHAR(100)) = @visit
    `);

  console.log(`--- ${c.name} (iReg ${c.iReg_No}, OP ${c.visit}) ---`);
  console.log("UI shows:     04/06/2026, ~9:41 am");
  console.log(JSON.stringify(r.recordset[0] ?? { error: "not found" }, null, 2));
  console.log("");
}

process.exit(0);
