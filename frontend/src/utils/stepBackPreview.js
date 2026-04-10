/**
 * Matches backend `stepBackToken` logic for UI preview only.
 */
export const getStepBackPreview = (row = {}) => {
  const status = String(row?.status ?? "");
  const hasConsultStart = Boolean(row?.consult_start);
  const hasConsultEnd = Boolean(row?.consult_end);

  if (status === "WAITING") {
    return { canStep: false };
  }

  if (status === "IN_TREATMENT") {
    const nextStatus = hasConsultStart ? "CONSULTING" : "WAITING";
    return {
      canStep: true,
      previewStatus: nextStatus,
      previewDetail:
        nextStatus === "CONSULTING"
          ? "Treatment start will be cleared. The token returns to consulting."
          : "Treatment start will be cleared. The token returns to waiting (no consult recorded)."
    };
  }

  if (status === "CONSULTING" && hasConsultEnd) {
    return {
      canStep: true,
      previewStatus: "CONSULTING",
      previewSubtitle: "Consult reopened",
      previewDetail:
        "Consult end will be removed. You can continue or end consultation again before treatment."
    };
  }

  if (status === "CONSULTING" && hasConsultStart && !hasConsultEnd) {
    return {
      canStep: true,
      previewStatus: "WAITING",
      previewDetail: "Consult start will be cleared. The token returns to the waiting pool."
    };
  }

  return { canStep: false };
};
