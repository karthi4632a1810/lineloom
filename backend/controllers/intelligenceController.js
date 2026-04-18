import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";
import {
  getIntelligenceSummary,
  getModelVersion,
  recordOperationalAction,
  refreshModelVersionRecord
} from "../services/intelligenceService.js";
import { ApiError } from "../utils/apiError.js";

export const intelligenceSummaryHandler = asyncHandler(async (_req, res) => {
  const data = await getIntelligenceSummary();
  return sendSuccess(res, data, "Intelligence summary");
});

export const intelligenceForecastHandler = asyncHandler(async (_req, res) => {
  const data = await getIntelligenceSummary();
  return sendSuccess(res, data.forecast, "Forecast");
});

export const recordActionHandler = asyncHandler(async (req, res) => {
  const summary = String(req.body?.summary ?? "").trim();
  if (!summary) {
    throw new ApiError("summary is required", 400);
  }
  const payload = {
    ...req.body,
    summary,
    recorded_by: req.user?.email ?? req.body?.recorded_by ?? ""
  };
  const row = await recordOperationalAction(payload);
  return sendSuccess(res, row, "Action recorded", 201);
});

export const modelRefreshHandler = asyncHandler(async (_req, res) => {
  const row = await refreshModelVersionRecord();
  return sendSuccess(res, row, "Model version updated");
});

export const modelVersionHandler = asyncHandler(async (_req, res) => {
  const row = await getModelVersion();
  return sendSuccess(res, row, "Model version");
});
