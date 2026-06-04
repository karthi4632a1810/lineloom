import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { searchHisPatients } from "../services/hisService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const rows = await searchHisPatients({
  reg_no: "6076041",
  date_from: "2026-06-04",
  date_to: "2026-06-04"
});

const hit = rows.find((r) => r.visit_id === "IP07012055" || r.c_pat_name?.includes("Shanthanam"));
console.log("rows returned:", rows.length);
console.log("Shanthanam / IP07012055 in results:", hit ? "YES (unexpected)" : "NO (mock excluded)");
if (rows[0]) {
  console.log("sample:", rows[0].c_pat_name, rows[0].visit_id, rows[0].i_user_id);
}

process.exit(0);
