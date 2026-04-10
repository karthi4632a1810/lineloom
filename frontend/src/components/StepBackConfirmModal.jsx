import { useEffect, useMemo, useState } from "react";
import { getStepBackPreview } from "../utils/stepBackPreview";

export const StepBackConfirmModal = ({ row, onClose, onConfirm, isSubmitting }) => {
  const [confirmed, setConfirmed] = useState(false);
  const preview = useMemo(() => (row ? getStepBackPreview(row) : null), [row]);

  useEffect(() => {
    setConfirmed(false);
  }, [row?.token_id]);

  if (!row || !preview?.canStep) {
    return null;
  }

  const tokenId = String(row.token_id ?? "");

  return (
    <section className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="step-back-title">
      <article className="modal-card consult-modal step-back-modal">
        <div className="consult-modal-header">
          <h3 id="step-back-title">Revert one step?</h3>
        </div>
        <div className="consult-modal-form">
          <p className="confirm-text">Are you sure you want to move this token one step backward?</p>
          <div className="step-back-preview">
            <div className="step-back-preview-status">
              <div>
                <span className="step-back-preview-label">Current status</span>
                <span className={`status-chip status-${String(row.status).toLowerCase()}`}>
                  {row.status}
                </span>
              </div>
              <span className="step-back-arrow" aria-hidden>
                ←
              </span>
              <div>
                <span className="step-back-preview-label">After revert</span>
                <span className={`status-chip status-${String(preview.previewStatus).toLowerCase()}`}>
                  {preview.previewStatus}
                </span>
                {preview.previewSubtitle ? (
                  <span className="step-back-preview-sub">{preview.previewSubtitle}</span>
                ) : null}
              </div>
            </div>
            <p className="step-back-detail">{preview.previewDetail}</p>
          </div>
          <label className="step-back-checkbox-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I confirm changing this token to the &quot;After revert&quot; status above
          </label>
          <div className="consult-modal-actions">
            <button
              type="button"
              onClick={() => onConfirm(tokenId)}
              disabled={!confirmed || isSubmitting}
            >
              {isSubmitting ? "Working…" : "Yes, revert"}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
          </div>
        </div>
      </article>
    </section>
  );
};
