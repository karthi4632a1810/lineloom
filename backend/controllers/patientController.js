import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";
import { getPatientRecord } from "../services/patientRecordService.js";

export const getPatientRecordHandler = asyncHandler(async (req, res) => {
  const patientId = String(req?.params?.patientId ?? "").trim();
  const record = await getPatientRecord(patientId);
  return sendSuccess(res, record, "Patient record fetched");
});
