import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";
import { fetchHisPatients, searchHisPatients } from "../services/hisService.js";

export const getHisPatients = asyncHandler(async (_req, res) => {
  const patients = await fetchHisPatients();
  return sendSuccess(res, patients, "Fetched patients from HIS");
});

export const searchPatientsFromHis = asyncHandler(async (req, res) => {
  const patients = await searchHisPatients({
    name: req?.query?.name,
    reg_no: req?.query?.reg_no,
    date_from: req?.query?.date_from,
    date_to: req?.query?.date_to
  });
  return sendSuccess(res, patients, "Searched patients from HIS");
});
