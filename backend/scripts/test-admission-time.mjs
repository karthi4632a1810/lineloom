import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getHisPool, sql } from "../config/sqlServer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const regNo = process.argv[2] ?? "6076041";
const visitId = process.argv[3] ?? "IP07012055";

const query = `
  SELECT TOP 5
    CAST(ip.iIP_Reg_No AS VARCHAR(100)) AS visit_id,
    ip.dIP_dt AS raw_dt,
    CONVERT(VARCHAR(23), ip.dIP_dt, 121) AS dt_121,
    CONVERT(VARCHAR(30), ip.dIP_dt, 109) AS dt_109,
    SQL_VARIANT_PROPERTY(ip.dIP_dt, 'BaseType') AS base_type
  FROM [dbo].[Mast_IP_Admission] ip
  WHERE CAST(ip.iIP_Reg_No AS VARCHAR(100)) LIKE '%' + @visit + '%'
     OR CAST(pm.iPat_id AS VARCHAR(100)) IN (
       SELECT CAST(pm2.iPat_id AS VARCHAR(100))
       FROM [dbo].[Mast_Patient] pm2
       WHERE CAST(pm2.iReg_No AS VARCHAR(100)) LIKE '%' + @reg + '%'
     )
  ORDER BY ip.dIP_dt DESC;
`;

const pool = await getHisPool();
const req = pool.request();
req.input("reg", sql.VarChar(50), regNo);
req.input("visit", sql.VarChar(50), visitId);
const result = await req.query(`
  SELECT TOP 5
    CAST(ip.iIP_Reg_No AS VARCHAR(100)) AS visit_id,
    ip.dIP_dt AS raw_dt,
    CONVERT(VARCHAR(23), ip.dIP_dt, 121) AS dt_121
  FROM [dbo].[Mast_IP_Admission] ip
  INNER JOIN [dbo].[Mast_Patient] pm ON ip.iPat_id = pm.iPat_id
  WHERE CAST(ip.iIP_Reg_No AS VARCHAR(100)) LIKE '%' + @visit + '%'
     OR CAST(pm.iReg_No AS VARCHAR(100)) LIKE '%' + @reg + '%'
  ORDER BY ip.dIP_dt DESC
`);

for (const row of result.recordset ?? []) {
  const raw = row.raw_dt;
  console.log({
    visit_id: row.visit_id,
    dt_121: row.dt_121,
    raw_type: raw?.constructor?.name,
    raw_value: raw,
    raw_getHours: raw instanceof Date ? raw.getHours() : null,
    raw_toISOString: raw instanceof Date ? raw.toISOString() : null
  });
}

const now = await pool.request().query(`
  SELECT
    GETDATE() AS server_now,
    CONVERT(VARCHAR(23), GETDATE(), 121) AS now_121,
    SYSDATETIMEOFFSET() AS server_offset
`);
console.log("SQL server clock:", now.recordset[0]);
console.log("Node local now:", new Date().toString());

process.exit(0);
