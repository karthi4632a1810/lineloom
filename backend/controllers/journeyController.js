import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";
import { getDepartmentJourneyFunnel } from "../services/journeyService.js";

const filtersFromQuery = (query = {}) => ({
  from: query?.from,
  to: query?.to,
  department: query?.department
});

export const departmentFunnelHandler = asyncHandler(async (req, res) => {
  const data = await getDepartmentJourneyFunnel(filtersFromQuery(req.query ?? {}));
  return sendSuccess(res, data, "Department journey funnel");
});
