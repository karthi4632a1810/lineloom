import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getHisPool, sql } from "../config/sqlServer.js";
import { sqlDateTimeExpr } from "../utils/hospitalDateTime.js";
import { fetchLabHistoryForRegistrations } from "../services/labHisService.js";
import { fetchBillsForRegistrations } from "../services/billingHisService.js";
import { fetchPharmacyForRegistrations } from "../services/pharmacyHisService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const opReg = process.argv[2] ?? "6195879";
const patientHint = process.argv[3] ?? "4903882";
const day = new Date(process.argv[4] ?? "2026-06-03");

const pool = await getHisPool();

const visitRow = await pool
  .request()
  .input("visit", sql.VarChar(50), opReg)
  .query(`
    SELECT TOP 1
      CAST(op.iOP_Reg_No AS VARCHAR(100)) AS op_reg,
      CAST(pm.iReg_No AS VARCHAR(100)) AS i_reg_no,
      CAST(pm.iPat_id AS VARCHAR(100)) AS i_pat_id,
      CAST(pm.cPat_Name AS VARCHAR(200)) AS patient_name,
      CAST(op.iDept_id AS VARCHAR(100)) AS dept_id,
      ${sqlDateTimeExpr("op.dOP_dt")} AS admission_at,
      pm.iUser_id
    FROM dbo.Mast_OP_Admission op
    INNER JOIN dbo.Mast_Patient pm ON op.iPat_id = pm.iPat_id
    WHERE CAST(op.iOP_Reg_No AS VARCHAR(100)) = @visit
  `);

console.log("=== OP visit (KMCH_Frontoffice) ===");
console.log(JSON.stringify(visitRow.recordset[0] ?? { error: "not found" }, null, 2));

const byPatId = await pool
  .request()
  .input("pat", sql.VarChar(50), patientHint)
  .query(`
    SELECT TOP 3
      CAST(pm.iReg_No AS VARCHAR(100)) AS i_reg_no,
      CAST(pm.iPat_id AS VARCHAR(100)) AS i_pat_id,
      CAST(pm.cPat_Name AS VARCHAR(200)) AS patient_name
    FROM dbo.Mast_Patient pm
    WHERE CAST(pm.iPat_id AS VARCHAR(100)) = @pat
       OR CAST(pm.iReg_No AS VARCHAR(100)) = @pat
  `);

console.log("\n=== Patient hint", patientHint, "(iPat_id or iReg_No) ===");
console.log(JSON.stringify(byPatId.recordset, null, 2));

const visit = visitRow.recordset[0];
const regNos = [
  opReg,
  patientHint,
  visit?.i_reg_no,
  visit?.i_pat_id
].filter(Boolean);

const unique = [...new Set(regNos.map(String))];
console.log("\n=== HIS lookup reg numbers:", unique.join(", "), "on", day.toISOString().slice(0, 10), "===");

const lab = await fetchLabHistoryForRegistrations(unique, day);
const bills = await fetchBillsForRegistrations(unique, day);
let pharmacy = [];
try {
  pharmacy = await fetchPharmacyForRegistrations(unique, day);
} catch (e) {
  console.log("pharmacy error:", e.message);
}

console.log("\nLab rows:", lab.length);
for (const row of lab) {
  console.log(
    `  reg=${row.reg_no} req=${row.request_no} ${row.procedure?.slice(0, 40)} status=${row.status} request=${row.request_at}`
  );
}

console.log("\nBilling rows:", bills.length);
for (const row of bills) {
  console.log(
    `  reg=${row.reg_no} bill=${row.bill_no} amt=${row.amount} date=${row.bill_date} name=${row.patient_name}`
  );
}

console.log("\nPharmacy rows:", pharmacy.length);
for (const row of pharmacy.slice(0, 5)) {
  console.log(`  reg=${row.reg_no ?? row.regNo} bill=${row.bill_no ?? row.billNo}`);
}
if (pharmacy.length > 5) {
  console.log(`  ... and ${pharmacy.length - 5} more`);
}

process.exit(0);
