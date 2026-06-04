import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getHisPool } from "../config/sqlServer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const pool = await getHisPool();

const byUser = await pool.request().query(`
  SELECT pm.iUser_id, COUNT(*) cnt
  FROM dbo.Mast_OP_Admission op
  INNER JOIN dbo.Mast_Patient pm ON op.iPat_id = pm.iPat_id
  WHERE CAST(op.dOP_dt AS DATE) = CAST(GETDATE() AS DATE)
    AND pm.iPat_Type_id = 62
  GROUP BY pm.iUser_id
  ORDER BY cnt DESC
`);

console.log("Type 62 OP today by iUser_id:");
console.table(byUser.recordset);

const shanUser = await pool.request().query(`
  SELECT pm.iUser_id, op.iUser_id AS op_user, ip.iUser_id AS ip_user
  FROM dbo.Mast_Patient pm
  LEFT JOIN dbo.Mast_IP_Admission ip ON ip.iPat_id = pm.iPat_id AND CAST(ip.iIP_Reg_No AS VARCHAR(100)) = 'IP07012055'
  LEFT JOIN dbo.Mast_OP_Admission op ON op.iPat_id = pm.iPat_id AND CAST(op.dOP_dt AS DATE) = CAST(GETDATE() AS DATE)
  WHERE pm.iPat_id = 5146191
`);
console.log("\nShanthanam users:", shanUser.recordset[0]);

const modules = await pool.request().query(`
  SELECT TOP 20 o.name, m.definition
  FROM sys.sql_modules m
  INNER JOIN sys.objects o ON m.object_id = o.object_id
  WHERE m.definition LIKE '%Z%Patient%'
     OR m.definition LIKE '%Z Patient%'
     OR m.definition LIKE '%zpatient%'
     OR m.definition LIKE '%iPat_Type_id%62%'
`);
for (const row of modules.recordset ?? []) {
  console.log("\n---", row.name, "---");
  const snippet = row.definition?.slice(0, 500);
  console.log(snippet);
}

process.exit(0);
