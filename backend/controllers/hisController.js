import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";
import { fetchHisPatients, searchHisPatients } from "../services/hisService.js";

export const getHisPatients = asyncHandler(async (_req, res) => {
  const patients = await fetchHisPatients();
  return sendSuccess(res, patients, "Fetched patients from HIS");
});

export const searchPatientsFromHis = asyncHandler(async (req, res) => {
  const search = String(req?.query?.q ?? "");
  const patients = await searchHisPatients(search);
  return sendSuccess(res, patients, "Searched patients from HIS");
});
