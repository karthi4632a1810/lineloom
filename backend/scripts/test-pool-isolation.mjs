import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getHisPool } from "../config/sqlServer.js";
import { getPharmacyPool } from "../config/pharmacySql.js";
import { fetchPharmacyForRegistration } from "../services/pharmacyHisService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

await getHisPool();
const pharmacyPool = await getPharmacyPool();
console.log("Pharmacy pool database:", pharmacyPool.config?.database);

const rows = await fetchPharmacyForRegistration("4900039", new Date("2026-06-03"));
console.log("Pharmacy rows for 4900039:", rows.length);
if (rows[0]) {
  console.log("  First bill:", rows[0].bill_no, rows[0].bill_at);
}
process.exit(0);
