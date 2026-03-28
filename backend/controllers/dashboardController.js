import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";
import { getDashboardSummary, getDashboardTokens } from "../services/dashboardService.js";

const getFiltersFromQuery = (query = {}) => ({
  from: String(query?.from ?? ""),
  to: String(query?.to ?? ""),
  search: String(query?.search ?? ""),
  department: String(query?.department ?? "")
});

export const dashboardSummary = asyncHandler(async (req, res) => {
  const summary = await getDashboardSummary(getFiltersFromQuery(req.query));
  return sendSuccess(res, summary, "Dashboard summary fetched");
});

export const dashboardTokenTable = asyncHandler(async (req, res) => {
  const rows = await getDashboardTokens(getFiltersFromQuery(req.query));
  return sendSuccess(res, rows, "Dashboard tokens fetched");
});
