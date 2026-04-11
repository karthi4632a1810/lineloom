import { useEffect, useMemo, useState } from "react";
import {
  getAvailableRevertAnchors,
  getRevertPreviewForAnchor,
  getVisitPhaseChipClass,
  getVisitPhaseLabel
} from "../utils/revertAnchors";

export const RevertConfirmModal = ({ row, onClose, onConfirm, isSubmitting }) => {
  const options = useMemo(() => (row ? getAvailableRevertAnchors(row) : []), [row]);
  const [anchor, setAnchor] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setAnchor("");
    setConfirmed(false);
  }, [row?.token_id]);

  const preview = useMemo(() => {
    if (!row || !anchor) {
      return null;
    }
    return getRevertPreviewForAnchor(row, anchor);
  }, [row, anchor]);

  if (!row || !options.length) {
    return null;
  }

  const tokenId = String(row.token_id ?? "");

  return (
    <section className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="revert-modal-title">
      <article className="modal-card consult-modal step-back-modal revert-modal">
        <div className="consult-modal-header">
          <h3 id="revert-modal-title">Revert to an earlier step</h3>
        </div>
        <div className="consult-modal-form">
          <p className="confirm-text">
            Choose how far back to move this visit. Only milestones before the current stage are shown.
          </p>
          <label className="revert-anchor-field" htmlFor="revert-anchor-select">
            Revert to
          </label>
          <select
            id="revert-anchor-select"
            className="revert-anchor-select"
            value={anchor}
            onChange={(event) => {
              setAnchor(event.target.value);
              setConfirmed(false);
            }}
          >
            <option value="">Select a step…</option>
            {options.map((opt) => (
              <option key={opt.anchor} value={opt.anchor}>
                {opt.label}
              </option>
            ))}
          </select>
          {preview ? (
            <div className="step-back-preview">
              <div className="step-back-preview-status">
                <div>
                  <span className="step-back-preview-label">Current phase</span>
                  <span className={`status-chip ${getVisitPhaseChipClass(row)}`}>
                    {getVisitPhaseLabel(row)}
                  </span>
                </div>
                <span className="step-back-arrow" aria-hidden>
                  ←
                </span>
                <div>
                  <span className="step-back-preview-label">After revert</span>
                  <span className={`status-chip ${preview.previewPhaseChipClass}`}>
                    {preview.previewPhaseLabel}
                  </span>
                </div>
              </div>
              <p className="step-back-detail">{preview.previewDetail}</p>
            </div>
          ) : (
            <p className="revert-hint muted">Select a milestone to see the resulting status and details.</p>
          )}
          <label className="step-back-checkbox-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              disabled={!anchor}
            />
            <span className="step-back-checkbox-text">
              I confirm moving this token to the &quot;After revert&quot; state above
            </span>
          </label>
          <div className="consult-modal-actions">
            <button
              type="button"
              onClick={() => onConfirm(tokenId, anchor)}
              disabled={!confirmed || !anchor || isSubmitting}
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
