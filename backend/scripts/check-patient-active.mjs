import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getHisPool, sql } from "../config/sqlServer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const pool = await getHisPool();

const activeStats = await pool.request().query(`
  SELECT bActive, bDead, COUNT(*) AS cnt
  FROM [dbo].[Mast_Patient]
  GROUP BY bActive, bDead
  ORDER BY cnt DESC
`);
console.log("Mast_Patient bActive/bDead counts:");
console.log(JSON.stringify(activeStats.recordset, null, 2));

const typeStats = await pool.request().query(`
  SELECT iPat_Type_id, COUNT(*) AS cnt
  FROM [dbo].[Mast_Patient]
  GROUP BY iPat_Type_id
  ORDER BY cnt DESC
`);
console.log("\niPat_Type_id distribution (top 15):");
console.log(JSON.stringify(typeStats.recordset.slice(0, 15), null, 2));

const todayOp = await pool.request().query(`
  SELECT TOP 10
    CAST(pm.iPat_id AS VARCHAR(100)) AS patient_id,
    CAST(pm.iReg_No AS VARCHAR(100)) AS i_reg_no,
    pm.bActive,
    pm.bDead,
    pm.iPat_Type_id,
    CAST(pm.cPat_Name AS VARCHAR(200)) AS name
  FROM [dbo].[Mast_OP_Admission] op
  INNER JOIN [dbo].[Mast_Patient] pm ON op.iPat_id = pm.iPat_id
  WHERE CAST(op.dOP_dt AS DATE) = CAST(GETDATE() AS DATE)
  ORDER BY op.dOP_dt DESC
`);
console.log("\nToday's OP admissions (sample):");
console.log(JSON.stringify(todayOp.recordset, null, 2));

process.exit(0);
