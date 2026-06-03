import dotenv from "dotenv";
import { fetchPharmacyForRegistration } from "../services/pharmacyHisService.js";
import { fetchLabHistoryForRegistration } from "../services/labHisService.js";
import { fetchBillsForRegistration } from "../services/billingHisService.js";

dotenv.config();

const regNo = process.argv[2] ?? "6195879";
const day = new Date("2026-06-03");

const run = async (label, fn) => {
  const t0 = Date.now();
  const rows = await fn();
  console.log(label, "ms", Date.now() - t0, "rows", rows.length);
};

await run("pharmacy", () => fetchPharmacyForRegistration(regNo, day));
await run("lab", () => fetchLabHistoryForRegistration(regNo, day));
await run("billing", () => fetchBillsForRegistration(regNo, day));
