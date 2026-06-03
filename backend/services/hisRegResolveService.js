import { buildHisRegNumbers } from "../utils/hisRegNumbers.js";
import { fetchPatientRegNoForVisit } from "./hisService.js";

/** All reg numbers to pass into pharmacy/lab/billing SPs for one token. */
export const resolveHisRegNumbersForToken = async (token = null) => {
  const visitId = String(token?.visit_id ?? "").trim();
  const patientId = String(token?.patient_id ?? "").trim();
  let patientRegNo = String(token?.patient_reg_no ?? "").trim();

  if (!patientRegNo && patientId && visitId) {
    patientRegNo = await fetchPatientRegNoForVisit(patientId, visitId);
  }

  return buildHisRegNumbers({ visit_id: visitId, patient_reg_no: patientRegNo });
};
