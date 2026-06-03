/** Unique non-empty registration identifiers for HIS stored procedures. */
export const uniqueHisRegNumbers = (values = []) => {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const id = String(value ?? "").trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
};

/** OP/IP visit reg plus patient master reg (iReg_No) when known. */
export const buildHisRegNumbers = ({ visit_id = "", patient_reg_no = "" } = {}) =>
  uniqueHisRegNumbers([visit_id, patient_reg_no]);
