import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getHisPool } from "../config/sqlServer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const pool = await getHisPool();

const queries = [
  ["pMast_Pattype_Pricelist", "SELECT TOP 20 * FROM dbo.pMast_Pattype_Pricelist WHERE iPat_Type_id = 62 OR iPat_type_id = 62"],
  ["Ward_Ctrl_Pattype", "SELECT TOP 20 * FROM dbo.Ward_Ctrl_Pattype WHERE iPat_Type_id = 62 OR iPat_type_id = 62"],
  ["Mast_Pat_Type all", "SELECT TOP 50 * FROM dbo.Mast_Pat_Type"],
  ["pMast distinct types", "SELECT DISTINCT iPat_Type_id FROM dbo.pMast_Pattype_Pricelist ORDER BY 1"]
];

for (const [label, sql] of queries) {
  try {
    const r = await pool.request().query(sql);
    console.log(`\n=== ${label} (${r.recordset.length} rows) ===`);
    if (r.recordset[0]) {
      console.log("columns:", Object.keys(r.recordset[0]).join(", "));
      console.table(r.recordset.slice(0, 10));
    }
  } catch (e) {
    console.log(`\n=== ${label}: ${e.message} ===`);
  }
}

const opPatType = await pool.request().query(`
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'Mast_OP_Admission' AND COLUMN_NAME LIKE '%Pat%Type%'
`);
console.log("\nOP Pat Type columns:", opPatType.recordset);

const opDist = await pool.request().query(`
  SELECT op.iOP_Pat_Type_Id, COUNT(*) cnt
  FROM dbo.Mast_OP_Admission op
  WHERE CAST(op.dOP_dt AS DATE) = CAST(GETDATE() AS DATE)
  GROUP BY op.iOP_Pat_Type_Id
  ORDER BY cnt DESC
`);
console.log("\nToday OP by iOP_Pat_Type_Id:");
console.table(opDist.recordset);

process.exit(0);
