import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";
import {
  acknowledgeAlert,
  getDeterministicRecommendations,
  listAlerts
} from "../services/alertService.js";
import { ApiError } from "../utils/apiError.js";

export const listAlertsHandler = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query?.limit ?? 100) || 100, 500);
  const unacknowledged_only = String(req.query?.unacknowledged_only ?? "") === "1";
  const rows = await listAlerts({ limit, unacknowledged_only });
  return sendSuccess(res, rows, "Alerts loaded");
});

export const acknowledgeAlertHandler = asyncHandler(async (req, res) => {
  const user = String(req.body?.user ?? req.user?.email ?? "").trim();
  const row = await acknowledgeAlert(req.params.id, user);
  if (!row) {
    throw new ApiError("Alert not found", 404);
  }
  return sendSuccess(res, row, "Alert acknowledged");
});

export const recommendationsHandler = asyncHandler(async (_req, res) => {
  const data = await getDeterministicRecommendations();
  return sendSuccess(res, data, "Recommendations loaded");
});
