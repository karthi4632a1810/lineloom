import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getHisPool } from "../config/sqlServer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const pool = await getHisPool();

const op = await pool.request().query(`
  SELECT
    CASE WHEN pm.iUser_id = 9999 THEN 'mock_user_9999' ELSE 'other_user' END AS bucket,
    pm.iPat_Type_id,
    COUNT(*) cnt
  FROM dbo.Mast_OP_Admission op
  INNER JOIN dbo.Mast_Patient pm ON op.iPat_id = pm.iPat_id
  WHERE CAST(op.dOP_dt AS DATE) = CAST(GETDATE() AS DATE)
  GROUP BY CASE WHEN pm.iUser_id = 9999 THEN 'mock_user_9999' ELSE 'other_user' END, pm.iPat_Type_id
  ORDER BY bucket, cnt DESC
`);
console.log("OP today by user bucket + pat type:");
console.table(op.recordset);

const ip = await pool.request().query(`
  SELECT
    CASE WHEN pm.iUser_id = 9999 OR ip.iUser_id = 9999 THEN 'mock_user_9999' ELSE 'other_user' END AS bucket,
    COUNT(*) cnt
  FROM dbo.Mast_IP_Admission ip
  INNER JOIN dbo.Mast_Patient pm ON ip.iPat_id = pm.iPat_id
  WHERE CAST(ip.dIP_dt AS DATE) = CAST(GETDATE() AS DATE)
  GROUP BY CASE WHEN pm.iUser_id = 9999 OR ip.iUser_id = 9999 THEN 'mock_user_9999' ELSE 'other_user' END
`);
console.log("\nIP today by user bucket:");
console.table(ip.recordset);

const shan = await pool.request().query(`
  SELECT pm.iUser_id, ip.iUser_id ip_u, op.iUser_id op_u
  FROM dbo.Mast_Patient pm
  LEFT JOIN dbo.Mast_IP_Admission ip ON ip.iPat_id = pm.iPat_id AND ip.iIP_Reg_No = 'IP07012055'
  LEFT JOIN dbo.Mast_OP_Admission op ON op.iPat_id = pm.iPat_id AND CAST(op.dOP_dt AS DATE) = CAST(GETDATE() AS DATE)
  WHERE pm.iReg_No = '6076041'
`);
console.log("\nShanthanam users:", shan.recordset[0]);

process.exit(0);
