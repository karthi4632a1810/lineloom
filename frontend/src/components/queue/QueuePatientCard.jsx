import { Link } from "react-router-dom";
import { tokenDetailPath } from "../../utils/tokenPaths.js";

const statusClass = (status = "") => {
  const key = String(status).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `nf-lq-status nf-lq-status--${key || "unknown"}`;
};

export const QueuePatientCard = ({
  row = {},
  isSubmitting = false,
  onOpenDetail,
  onStartConsult,
  onEndConsult,
  onStartTreatment,
  onCompleteVisit,
  onEndTreatment,
  onRevert,
  canRevert = false,
  showActions = true,
  footerNote = null,
  formatSeconds = (v) => String(v ?? "—"),
  getTatSeconds = () => null,
  overallSeconds: overallSecondsProp = null
}) => {
  const detailPath = tokenDetailPath(String(row.token_id ?? "").trim());
  const overallSeconds =
    overallSecondsProp ??
    ["waiting", "consult", "lab_wait", "lab_test", "treatment"]
      .map((k) => getTatSeconds(row, k))
      .filter((v) => v != null)
      .reduce((sum, v) => sum + v, 0);

  const stop = (event) => event.stopPropagation();

  return (
    <article
      className="nf-lq-card"
      onClick={() => onOpenDetail?.(row)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetail?.(row);
        }
      }}
    >
      <div className="nf-lq-card-main">
        <div className="nf-lq-card-ident">
          <Link to={detailPath} className="nf-lq-queue-no" onClick={stop} title={row.token_id}>
            #{row.department_queue_no ?? "—"}
          </Link>
          <div>
            <Link to={detailPath} className="nf-lq-name" onClick={stop}>
              {row.name || "Unknown patient"}
            </Link>
            <p className="nf-lq-meta">
              {row.department || "—"}
              {row.phone ? ` · ${row.phone}` : ""}
              {footerNote ? ` · ${footerNote}` : ""}
            </p>
          </div>
        </div>
        <span className={statusClass(row.status)}>{row.status || "—"}</span>
      </div>

      <div className="nf-lq-metrics">
        <div className="nf-lq-metric">
          <span className="nf-lq-metric-label">Waiting</span>
          <span className="nf-lq-metric-value">{formatSeconds(getTatSeconds(row, "waiting"))}</span>
        </div>
        <div className="nf-lq-metric">
          <span className="nf-lq-metric-label">Consult</span>
          <span className="nf-lq-metric-value">{formatSeconds(getTatSeconds(row, "consult"))}</span>
        </div>
        <div className="nf-lq-metric">
          <span className="nf-lq-metric-label">Treatment</span>
          <span className="nf-lq-metric-value">{formatSeconds(getTatSeconds(row, "treatment"))}</span>
        </div>
        <div className="nf-lq-metric nf-lq-metric--emph">
          <span className="nf-lq-metric-label">Overall</span>
          <span className="nf-lq-metric-value">{formatSeconds(overallSeconds)}</span>
        </div>
      </div>

      {showActions ? (
        <div className="nf-lq-actions" onClick={stop}>
          <button
            type="button"
            className="nf-lq-btn"
            onClick={() => onStartConsult?.(row)}
            disabled={isSubmitting || row.status !== "WAITING"}
          >
            Start consult
          </button>
          {row.status === "CONSULTING" && !row.consult_end ? (
            <button
              type="button"
              className="nf-lq-btn"
              onClick={() => onEndConsult?.(row)}
              disabled={isSubmitting}
            >
              End consult
            </button>
          ) : null}
          {row.status === "CONSULTING" && row.consult_end ? (
            <button
              type="button"
              className="nf-lq-btn"
              onClick={() => onStartTreatment?.(row)}
              disabled={isSubmitting}
            >
              Start treatment
            </button>
          ) : null}
          {row.status === "CONSULTING" && row.consult_end && !row.treatment_start ? (
            <button
              type="button"
              className="nf-lq-btn nf-lq-btn--primary"
              onClick={() => onCompleteVisit?.(row)}
              disabled={isSubmitting}
            >
              Complete visit
            </button>
          ) : null}
          <button
            type="button"
            className="nf-lq-btn"
            onClick={() => onEndTreatment?.(row)}
            disabled={isSubmitting || row.status !== "IN_TREATMENT"}
          >
            End treatment
          </button>
          <button
            type="button"
            className="nf-lq-btn nf-lq-btn--ghost"
            onClick={() => onRevert?.(row)}
            disabled={isSubmitting || row.status === "WAITING" || !canRevert}
          >
            Revert
          </button>
        </div>
      ) : null}
    </article>
  );
};
