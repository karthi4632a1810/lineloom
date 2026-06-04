import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";
import { getPatientRecord, searchPatientRecords } from "../services/patientRecordService.js";

export const searchPatientRecordsHandler = asyncHandler(async (req, res) => {
  const rows = await searchPatientRecords({
    patient_id: req?.query?.patient_id ?? "",
    name: req?.query?.name ?? "",
    reg_no: req?.query?.reg_no ?? "",
    date_from: req?.query?.date_from ?? "",
    date_to: req?.query?.date_to ?? ""
  });
  return sendSuccess(res, rows, "Patient records search completed");
});

export const getPatientRecordHandler = asyncHandler(async (req, res) => {
  const patientId = String(req?.params?.patientId ?? "").trim();
  const record = await getPatientRecord(patientId);
  return sendSuccess(res, record, "Patient record fetched");
});
