/**
 * Deletes every token and related queue data from MongoDB (fresh start).
 * Does not touch users, departments, or other admin config.
 *
 * Usage: node scripts/clearAllTokens.js --yes
 *    or: npm run clear-tokens -- --yes
 */
import dotenv from "dotenv";
import { connectMongo } from "../config/mongo.js";
import { Token } from "../models/Token.js";
import { TimeTracking } from "../models/TimeTracking.js";
import { DepartmentFlow } from "../models/DepartmentFlow.js";
import { AlertEvent } from "../models/AlertEvent.js";

dotenv.config();

const envOk = /^yes$/i.test(String(process.env.CLEAR_TOKENS_CONFIRM ?? "").trim());
const confirmed =
  envOk ||
  process.argv.includes("--yes") ||
  process.argv.includes("-y");

const main = async () => {
  if (!confirmed) {
    process.stderr.write(
      "Refusing to run: this deletes ALL tokens and queue-related records.\n" +
        "  node scripts/clearAllTokens.js --yes\n" +
        "  npm run clear-tokens:confirm\n" +
        "On Windows if npm drops flags: set CLEAR_TOKENS_CONFIRM=yes then npm run clear-tokens\n"
    );
    process.exit(1);
  }

  await connectMongo();

  const flows = await DepartmentFlow.deleteMany({});
  const tracking = await TimeTracking.deleteMany({});
  const tokens = await Token.deleteMany({});
  const alerts = await AlertEvent.deleteMany({});

  process.stdout.write(
    `Cleared MongoDB queue data:\n` +
      `  department_flows: ${flows.deletedCount}\n` +
      `  time_tracking:   ${tracking.deletedCount}\n` +
      `  tokens:          ${tokens.deletedCount}\n` +
      `  alert_events:    ${alerts.deletedCount}\n` +
      `\nUsers and departments are unchanged.\n` +
      `Optional: npm run seed   (sample tokens + logins)\n`
  );
  process.exit(0);
};

main().catch((error) => {
  process.stderr.write(`${error?.message ?? error}\n`);
  process.exit(1);
});
