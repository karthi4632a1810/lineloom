import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getHisPool } from "../config/sqlServer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const pool = await getHisPool();

const op = await pool.request().query(`
  SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN op.dOP_dt > GETDATE() THEN 1 ELSE 0 END) AS future_cnt
  FROM dbo.Mast_OP_Admission op
  WHERE CAST(op.dOP_dt AS DATE) = CAST(GETDATE() AS DATE)
`);

const ip = await pool.request().query(`
  SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN ip.dIP_dt > GETDATE() THEN 1 ELSE 0 END) AS future_cnt
  FROM dbo.Mast_IP_Admission ip
  WHERE CAST(ip.dIP_dt AS DATE) = CAST(GETDATE() AS DATE)
`);

console.log("OP today:", op.recordset[0]);
console.log("IP today:", ip.recordset[0]);

process.exit(0);
