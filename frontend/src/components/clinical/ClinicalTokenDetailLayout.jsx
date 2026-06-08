import { useMemo, useState } from "react";

const LogTable = ({ title, columns, rows, emptyMessage, searchQuery = "" }) => {
  const filtered = useMemo(() => {
    const q = String(searchQuery).trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [rows, searchQuery]);

  return (
    <div className="cc-log-section">
      <h4 className="cc-card-title" style={{ marginBottom: 10 }}>
        {title}
      </h4>
      <div className="cc-data-grid-wrap">
        <table className="cc-data-grid">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length ? (
              filtered.map((row, idx) => (
                <tr key={row._key ?? idx}>
                  {columns.map((col) => (
                    <td key={col.key}>{row[col.key] ?? "—"}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length}>
                  <div className="cc-empty">{emptyMessage}</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const ClinicalTokenDetailLayout = ({
  token = {},
  patient = {},
  tracking = {},
  visitPhaseLabel = "",
  visitPhaseChipClass = "",
  postConsultPlansSaved = [],
  postConsultLabel = (id) => id,
  isActing = false,
  actionError = "",
  onStartConsult,
  onEndConsult,
  onCompleteVisit,
  onRevert,
  revertAllowed = false,
  onStartTreatment,
  onEndTreatment,
  canStartTreatment = false,
  canEndTreatment = false,
  waitingSeconds,
  consultSeconds,
  treatmentSeconds,
  overallSeconds,
  consultStartedAt,
  consultDurationLabel,
  treatmentStartedAt,
  treatmentDurationLabel,
  pharmacyLogs = [],
  labLogs = [],
  billingPayments = [],
  patientJourneySteps = [],
  treatmentLogs = [],
  treatmentLabelPayments = [],
  formatDateTime = (v) => String(v ?? ""),
  formatSeconds = (v) => String(v ?? ""),
  visitCompletedAtLabel = "--"
}) => {
  const [logSearch, setLogSearch] = useState("");

  const pharmacyRows = [...pharmacyLogs].reverse().map((entry, idx) => ({
    _key: `p-${idx}-${entry?.bill_no || entry?.request_no || idx}`,
    num: idx + 1,
    bill: String(entry?.bill_no ?? "").trim() || "—",
    req: String(entry?.request_no ?? "").trim() || "—",
    requestAt: formatDateTime(entry?.request_at),
    billTime: formatDateTime(entry?.bill_at ?? entry?.start),
    completed: formatDateTime(entry?.completed_at ?? entry?.end),
    issue: String(entry?.issue_type ?? "").trim() || "—"
  }));

  const labRows = [...labLogs].reverse().map((entry, idx) => ({
    _key: `l-${idx}-${entry?.request_no}`,
    num: idx + 1,
    req: entry?.request_no || "—",
    request: formatDateTime(entry?.request_at),
    sample: formatDateTime(entry?.sample_received_at ?? entry?.start),
    completed: formatDateTime(entry?.completed_at ?? entry?.end),
    status: entry?.status || "—"
  }));

  const billingBillNoFromNote = (note = "") => {
    const match = String(note).match(/HIS bill\s+(\S+)/i);
    return match ? match[1] : "—";
  };

  const billingRows = [...billingPayments].reverse().map((entry, idx) => ({
    _key: `b-${idx}-${entry?.paid_at ?? idx}`,
    num: idx + 1,
    bill: billingBillNoFromNote(entry?.note),
    amount: entry?.amount != null ? String(entry.amount) : "—",
    posted: formatDateTime(entry?.paid_at),
    note: String(entry?.note ?? entry?.label ?? "").trim() || "—"
  }));

  const billingEmptyMessage = !tracking.consult_end
    ? "End consultation to load billing from HIS."
    : token.status === "COMPLETED"
      ? "No billing record found in HIS for this visit date."
      : "Waiting for bill in HIS…";

  return (
    <div className="cc-detail nf-visit-modern">
      <header className="cc-patient-header">
        <div className="cc-patient-hero">
          <div>
            <h1 className="cc-patient-name">{patient?.name ?? `Patient ${token.patient_id}`}</h1>
            <div className="cc-patient-meta-grid">
              <span className="cc-patient-meta-item">
                Patient ID <strong>{token.patient_id}</strong>
              </span>
              <span className="cc-patient-meta-item">
                OP Reg <strong>{token.visit_id}</strong>
              </span>
              {token.patient_reg_no && token.patient_reg_no !== token.visit_id ? (
                <span className="cc-patient-meta-item">
                  Master Reg <strong>{token.patient_reg_no}</strong>
                </span>
              ) : null}
              <span className="cc-patient-meta-item">
                Dept <strong>{token.department}</strong>
              </span>
              <span className="cc-patient-meta-item">
                Queue <strong>#{token.department_queue_no ?? "—"}</strong>
              </span>
              <span className="cc-patient-meta-item">
                {patient?.phone ? `Tel ${patient.phone}` : "Phone unavailable"}
              </span>
            </div>
            <div className="cc-badge-row">
              <span className={`cc-badge cc-badge--primary ${visitPhaseChipClass}`}>
                {visitPhaseLabel}
              </span>
              <span className="cc-badge cc-badge--neutral">{token.status}</span>
              {postConsultPlansSaved.map((id) => (
                <span key={id} className="cc-badge cc-badge--warning">
                  {postConsultLabel(id)}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="cc-actions">
          <button type="button" className="cc-btn" onClick={onStartConsult} disabled={isActing || token.status !== "WAITING"}>
            Start consult
          </button>
          <button
            type="button"
            className="cc-btn"
            onClick={onEndConsult}
            disabled={isActing || token.status !== "CONSULTING" || Boolean(tracking.consult_end)}
          >
            End consult
          </button>
          <button
            type="button"
            className="cc-btn cc-btn--success"
            onClick={onCompleteVisit}
            disabled={isActing || token.status === "COMPLETED"}
          >
            Complete visit
          </button>
          <button type="button" className="cc-btn" onClick={onStartTreatment} disabled={!canStartTreatment || isActing}>
            Start treatment
          </button>
          <button type="button" className="cc-btn" onClick={onEndTreatment} disabled={!canEndTreatment || isActing}>
            End treatment
          </button>
          <button
            type="button"
            className="cc-btn cc-btn--ghost"
            onClick={onRevert}
            disabled={isActing || token.status === "WAITING" || !revertAllowed}
          >
            Revert
          </button>
        </div>
      </header>

      {actionError ? (
        <p className="error-text" style={{ margin: 0 }}>
          {actionError}
        </p>
      ) : null}

      <div className="cc-kpi-row">
        <article className="cc-kpi" style={{ "--cc-kpi-accent": "#2563eb", "--cc-kpi-accent-soft": "#dbeafe" }}>
          <span className="cc-kpi-icon">⏱</span>
          <p className="cc-kpi-label">Total wait</p>
          <p className="cc-kpi-value">{formatSeconds(waitingSeconds)}</p>
          <p className="cc-kpi-sub">Queue to consult</p>
        </article>
        <article className="cc-kpi" style={{ "--cc-kpi-accent": "#0891b2", "--cc-kpi-accent-soft": "#cffafe" }}>
          <span className="cc-kpi-icon">🩺</span>
          <p className="cc-kpi-label">Consultation</p>
          <p className="cc-kpi-value">{formatSeconds(consultSeconds)}</p>
          <p className="cc-kpi-sub">{consultStartedAt} · {consultDurationLabel}</p>
        </article>
        <article className="cc-kpi" style={{ "--cc-kpi-accent": "#7c3aed", "--cc-kpi-accent-soft": "#ede9fe" }}>
          <span className="cc-kpi-icon">💉</span>
          <p className="cc-kpi-label">Treatment</p>
          <p className="cc-kpi-value">{formatSeconds(treatmentSeconds)}</p>
          <p className="cc-kpi-sub">{treatmentStartedAt} · {treatmentDurationLabel}</p>
        </article>
        <article className="cc-kpi" style={{ "--cc-kpi-accent": "#16a34a", "--cc-kpi-accent-soft": "#dcfce7" }}>
          <span className="cc-kpi-icon">◎</span>
          <p className="cc-kpi-label">{token.status === "COMPLETED" ? "Visit TAT" : "Est. TAT"}</p>
          <p className="cc-kpi-value">{formatSeconds(overallSeconds)}</p>
          <p className="cc-kpi-sub">
            {token.status === "COMPLETED" && visitCompletedAtLabel !== "--"
              ? `Completed ${visitCompletedAtLabel}`
              : "Queue start to finish"}
          </p>
        </article>
      </div>

      <div className="cc-grid-12">
        <div className="cc-col-8" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="cc-card">
            <div className="cc-card-header">
              <div>
                <h2 className="cc-card-title">Workflow activity log</h2>
                <p className="cc-card-sub">Search and review HIS events</p>
              </div>
            </div>
            <div className="cc-log-toolbar">
              <input
                className="cc-log-search"
                placeholder="Filter logs…"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
              />
            </div>
            <LogTable
              title="Pharmacy (HIS)"
              searchQuery={logSearch}
              emptyMessage={
                tracking.consult_end
                  ? "Waiting for pharmacy sale in HIS…"
                  : "End consultation to load pharmacy from HIS."
              }
              columns={[
                { key: "num", label: "#" },
                { key: "bill", label: "Bill #" },
                { key: "req", label: "Req #" },
                { key: "requestAt", label: "Request time" },
                { key: "billTime", label: "Bill time" },
                { key: "completed", label: "Completed" },
                { key: "issue", label: "Issue" }
              ]}
              rows={pharmacyRows}
            />
            <LogTable
              title="Lab (HIS)"
              searchQuery={logSearch}
              emptyMessage={
                !tracking.consult_end
                  ? "End consultation to load lab from HIS."
                  : token.status === "COMPLETED"
                    ? "No lab records found in HIS for this visit date."
                    : "Waiting for lab orders in HIS…"
              }
              columns={[
                { key: "num", label: "#" },
                { key: "req", label: "Req" },
                { key: "request", label: "Request" },
                { key: "sample", label: "Sample" },
                { key: "completed", label: "Completed" },
                { key: "status", label: "Status" }
              ]}
              rows={labRows}
            />
            <LogTable
              title="Billing (HIS)"
              searchQuery={logSearch}
              emptyMessage={billingEmptyMessage}
              columns={[
                { key: "num", label: "#" },
                { key: "bill", label: "Bill #" },
                { key: "amount", label: "Amount" },
                { key: "posted", label: "Posted" },
                { key: "note", label: "Note" }
              ]}
              rows={billingRows}
            />
            <LogTable
              title="Treatment"
              searchQuery={logSearch}
              emptyMessage="No treatment logs yet."
              columns={[
                { key: "num", label: "#" },
                { key: "start", label: "Start" },
                { key: "end", label: "End" },
                { key: "billed", label: "Bill (HIS)" }
              ]}
              rows={[...(treatmentLogs ?? [])].reverse().map((entry, idx) => {
                const chronoIndex = (treatmentLogs ?? []).length - 1 - idx;
                const billed = treatmentLabelPayments[chronoIndex]?.paid_at ?? tracking.billing_end;
                return {
                  _key: `t-${idx}`,
                  num: idx + 1,
                  start: formatDateTime(entry?.start),
                  end: formatDateTime(entry?.end),
                  billed: formatDateTime(billed)
                };
              })}
            />
          </section>
        </div>

        <div className="cc-col-4" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="cc-card">
            <div className="cc-card-header">
              <h2 className="cc-card-title">Patient journey</h2>
            </div>
            <div className="cc-journey">
              {patientJourneySteps.length === 0 ? (
                <p className="cc-empty">No journey steps yet.</p>
              ) : (
                patientJourneySteps.map((step, index) => {
                  const kindKey = String(step.kind ?? "core");
                  return (
                    <div
                      key={`${step.label}-${index}`}
                      className={`cc-journey-step ${step.done ? "done" : ""} ${step.active ? "active" : ""} kind-${kindKey}`}
                    >
                      <span className="cc-journey-dot">{step.done ? "✓" : ""}</span>
                      <div className="cc-journey-body">
                        <strong>{step.label}</strong>
                        <div className="cc-journey-duration">{step.timePrimary}</div>
                        {step.timeSecondary ? (
                          <div className="cc-journey-range">{step.timeSecondary}</div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
