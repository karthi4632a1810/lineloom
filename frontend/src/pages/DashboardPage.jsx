import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RevertConfirmModal } from "../components/RevertConfirmModal";
import { fetchActiveDepartments } from "../services/departmentService";
import { resolveEffectiveTreatmentStart } from "../utils/tatSegments";
import { canRevertVisit } from "../utils/revertAnchors";
import { fetchDashboardSummary, fetchDashboardTokens } from "../services/dashboardService";
import { fetchAlerts } from "../services/alertService";
import { fetchIntelligenceSummary } from "../services/intelligenceService";
import {
  completeVisitAfterConsultRequest,
  endCareRequest,
  endConsultRequest,
  startCareRequest,
  startConsultRequest,
  revertTokenRequest
} from "../services/tokenService";

const toDateTimeLocalValue = (value = new Date()) => {
  const date = new Date(value);
  const timezoneOffsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
};

const getTodayDefaultFilters = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return {
    from: toDateTimeLocalValue(start),
    to: toDateTimeLocalValue(end),
    search: "",
    department: ""
  };
};

const formatDateTime = (value = null) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
};

const normalizeTokenId = (value = "") => String(value ?? "").replace(/^\/+|\/+$/g, "");

export const DashboardPage = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState(() => getTodayDefaultFilters());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [consultStartModal, setConsultStartModal] = useState({ tokenId: "", department: "" });
  const [confirmAction, setConfirmAction] = useState({ tokenId: "", action: "", labsOrdered: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [departmentCatalog, setDepartmentCatalog] = useState([]);
  const [stepBackRow, setStepBackRow] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [quickAlerts, setQuickAlerts] = useState([]);
  const [intelligenceBrief, setIntelligenceBrief] = useState(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const departmentOptions = useMemo(
    () => [...new Set(rows.map((row) => row.department).filter(Boolean))],
    [rows]
  );

  const consultDepartmentOptions = useMemo(
    () => departmentCatalog.map((d) => d.name).filter(Boolean),
    [departmentCatalog]
  );

  const toSecondsFromMinutes = (value = null) => {
    if (value == null) {
      return null;
    }
    return Math.max(0, Math.round(Number(value) * 60));
  };

  const toSecondsFromRange = (start = null, end = null) => {
    if (!start) {
      return null;
    }
    const startMs = new Date(start).getTime();
    if (Number.isNaN(startMs)) {
      return null;
    }
    const endMs = end ? new Date(end).getTime() : nowMs;
    if (Number.isNaN(endMs)) {
      return null;
    }
    return Math.max(0, Math.floor((endMs - startMs) / 1000));
  };

  const formatSeconds = (totalSeconds = null) => {
    if (totalSeconds == null) {
      return "-";
    }
    const safe = Math.max(0, Number(totalSeconds) || 0);
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = safe % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    return `${minutes}m ${seconds}s`;
  };

  const getTatSeconds = (row = {}, key = "waiting") => {
    if (key === "waiting") {
      return toSecondsFromRange(
        row.waiting_start,
        row.consult_start ?? (row.status === "WAITING" ? null : row.consult_start)
      ) ?? toSecondsFromMinutes(row.waiting_tat_minutes);
    }
    if (key === "consult") {
      return toSecondsFromRange(
        row.consult_start,
        row.consult_end ?? (row.status === "CONSULTING" ? null : row.consult_end)
      ) ?? toSecondsFromMinutes(row.consulting_tat_minutes);
    }
    if (key === "treatment") {
      const start = resolveEffectiveTreatmentStart(row.treatment_start, row.consult_end);
      if (!start) {
        return null;
      }
      return (
        toSecondsFromRange(
          start,
          row.treatment_end ?? (row.status === "IN_TREATMENT" ? null : row.treatment_end)
        ) ?? toSecondsFromMinutes(row.treatment_tat_minutes)
      );
    }
    if (key === "billing") {
      if (!row.billing_start) {
        return null;
      }
      return (
        toSecondsFromRange(
          row.billing_start,
          row.billing_end ?? (row.status === "CONSULTING" && !row.billing_end ? null : row.billing_end)
        ) ?? toSecondsFromMinutes(row.billing_tat_minutes)
      );
    }
    if (key === "lab_wait") {
      if (!row.billing_end) {
        return null;
      }
      return (
        toSecondsFromRange(
          row.billing_end,
          row.lab_start ?? (row.status === "CONSULTING" && !row.lab_start ? null : row.lab_start)
        ) ?? toSecondsFromMinutes(row.lab_wait_tat_minutes)
      );
    }
    if (key === "lab_test") {
      if (!row.lab_start) {
        return null;
      }
      return (
        toSecondsFromRange(
          row.lab_start,
          row.lab_end ?? (row.status === "CONSULTING" && !row.lab_end ? null : row.lab_end)
        ) ?? toSecondsFromMinutes(row.lab_test_tat_minutes)
      );
    }
    return null;
  };

  useEffect(() => {
    fetchActiveDepartments()
      .then((list) => setDepartmentCatalog(Array.isArray(list) ? list : []))
      .catch(() => setDepartmentCatalog([]));
  }, []);

  const loadDashboard = async () => {
    setIsLoading(true);
    setError("");
    try {
      const [summaryData, tokenRows, alerts, intel] = await Promise.all([
        fetchDashboardSummary(filters),
        fetchDashboardTokens(filters),
        fetchAlerts({ limit: 5, unacknowledged_only: 1 }).catch(() => []),
        fetchIntelligenceSummary().catch(() => null)
      ]);
      setSummary(summaryData);
      setRows(tokenRows);
      setQuickAlerts(Array.isArray(alerts) ? alerts : []);
      setIntelligenceBrief(intel);
    } catch (loadError) {
      setError(loadError?.message ?? "Failed to load dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((previous) => ({ ...previous, [name]: value }));
  };

  const handleApplyFilters = async (event) => {
    event.preventDefault();
    await loadDashboard();
  };

  const openConsultStartModal = (row = null) => {
    const rowDept = String(row?.department ?? "").trim();
    const initial = consultDepartmentOptions.includes(rowDept) ? rowDept : "";
    setConsultStartModal({
      tokenId: String(row?.token_id ?? ""),
      department: initial
    });
  };

  const openConfirmAction = (tokenId = "", action = "", labsOrdered = false) => {
    setConfirmAction({ tokenId, action, labsOrdered });
  };

  const closeConsultStartModal = () => setConsultStartModal({ tokenId: "", department: "" });
  const closeConfirmAction = () => setConfirmAction({ tokenId: "", action: "", labsOrdered: false });

  const handleStartConsulting = async () => {
    if (!consultStartModal.tokenId) {
      return;
    }
    if (!String(consultStartModal.department ?? "").trim()) {
      setError("Select a department to start consultation.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      await startConsultRequest(consultStartModal.tokenId, {
        department: consultStartModal.department
      });
      closeConsultStartModal();
      await loadDashboard();
    } catch (actionError) {
      setError(actionError?.message ?? "Unable to start consulting");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmAction = async () => {
    const tokenId = String(confirmAction.tokenId ?? "");
    const action = String(confirmAction.action ?? "");
    if (!tokenId || !action) {
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      if (action === "end_consult") {
        await endConsultRequest(tokenId, { labs_ordered: Boolean(confirmAction.labsOrdered) });
      } else if (action === "start_treatment") {
        await startCareRequest(tokenId);
      } else if (action === "end_treatment") {
        await endCareRequest(tokenId);
      } else if (action === "complete_visit") {
        await completeVisitAfterConsultRequest(tokenId);
      }
      closeConfirmAction();
      await loadDashboard();
    } catch (actionError) {
      setError(actionError?.message ?? "Unable to update token state");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openRevertModal = (row = null) => {
    if (!canRevertVisit(row)) {
      return;
    }
    setStepBackRow(row);
  };

  const closeRevertModal = () => setStepBackRow(null);

  const executeRevert = async (tokenId = "", anchor = "") => {
    if (!tokenId || !String(anchor ?? "").trim()) {
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      await revertTokenRequest(tokenId, anchor);
      setStepBackRow(null);
      await loadDashboard();
    } catch (actionError) {
      setError(actionError?.message ?? "Unable to revert");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page">
      <h2>Patient Queue Dashboard</h2>

      {intelligenceBrief?.stats ? (
        <div className="intel-strip card">
          <p className="intel-strip-text">
            <strong>7-day insight:</strong>{" "}
            {intelligenceBrief.stats.anomaly
              ? intelligenceBrief.stats.anomaly_reason
              : `Mean daily average wait ${intelligenceBrief.stats.mean_7d_daily_avg_wait ?? "—"} min · naive forecast next day ${intelligenceBrief.forecast?.expected_avg_wait_minutes_next_day ?? "—"} min`}
          </p>
        </div>
      ) : null}

      {quickAlerts.length ? (
        <div className="alert-strip" role="status">
          {quickAlerts.map((a) => (
            <div key={a._id} className="alert-pill">
              <span>{a.message}</span>
              <button type="button" className="btn-inline" onClick={() => navigate("/alerts")}>
                Open alerts
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <form className="card filter-grid" onSubmit={handleApplyFilters}>
        <input
          type="datetime-local"
          name="from"
          value={filters.from}
          onChange={handleFilterChange}
          placeholder="From"
        />
        <input
          type="datetime-local"
          name="to"
          value={filters.to}
          onChange={handleFilterChange}
          placeholder="To"
        />
        <input
          type="text"
          name="search"
          value={filters.search}
          onChange={handleFilterChange}
          placeholder="Search patient id, name, visit id"
        />
        <select name="department" value={filters.department} onChange={handleFilterChange}>
          <option value="">All departments</option>
          {departmentOptions.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </select>
        <button type="submit" disabled={isSubmitting}>
          Apply Filters
        </button>
      </form>

      <div className="summary-grid">
        <article className="summary-card">
          <h4>Waiting Patients</h4>
          <p>{summary?.waiting_patient_count ?? 0}</p>
        </article>
        <article className="summary-card">
          <h4>Patients in Consulting</h4>
          <p>{summary?.patient_in_consulting_count ?? 0}</p>
        </article>
        <article className="summary-card">
          <h4>Patients in Treatment</h4>
          <p>{summary?.patient_in_treatment_count ?? 0}</p>
        </article>
        <article className="summary-card">
          <h4>Completed Patients</h4>
          <p>{summary?.patient_completed_count ?? 0}</p>
        </article>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {isLoading ? <p>Loading dashboard rows...</p> : null}
      {!isLoading && !error && !rows.length ? (
        <p>No patient tokens available for selected range.</p>
      ) : null}

      {!isLoading && rows.length ? (
        <article className="card table-card">
          <table>
            <thead>
              <tr>
                <th>Patient ID</th>
                <th>Name</th>
                <th>Visit ID</th>
                <th>Department</th>
                <th>Waiting TAT</th>
                <th>Consult TAT</th>
                <th>Treatment TAT</th>
                <th>Overall TAT</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.token_id}
                  className="clickable-row"
                  onClick={() => {
                    const cleanId = normalizeTokenId(row.token_id);
                    if (!cleanId) {
                      return;
                    }
                    navigate(`/tokens/${cleanId}`);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      const cleanId = normalizeTokenId(row.token_id);
                      if (!cleanId) {
                        return;
                      }
                      navigate(`/tokens/${cleanId}`);
                    }
                  }}
                >
                  <td>{row.patient_id}</td>
                  <td>{row.name}</td>
                  <td>{row.visit_id}</td>
                  <td>{row.department}</td>
                  <td>{formatSeconds(getTatSeconds(row, "waiting"))}</td>
                  <td>
                    <div className="tat-cell">
                      <strong>{formatSeconds(getTatSeconds(row, "consult"))}</strong>
                      {row.consulting_tat_minutes != null ? (
                        <div className="tat-hover">
                          <span className="info-icon" title="Show consult start/end">
                            i
                          </span>
                          <div className="tat-tooltip">
                            <div>Start: {formatDateTime(row.consult_start)}</div>
                            <div>End: {formatDateTime(row.consult_end)}</div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <div className="tat-cell">
                      <strong>{formatSeconds(getTatSeconds(row, "treatment"))}</strong>
                      {row.treatment_tat_minutes != null ? (
                        <div className="tat-hover">
                          <span className="info-icon" title="Show treatment start/end">
                            i
                          </span>
                          <div className="tat-tooltip">
                            <div>Start: {formatDateTime(row.treatment_start)}</div>
                            <div>End: {formatDateTime(row.treatment_end)}</div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    {formatSeconds(
                      ["waiting", "consult", "billing", "lab_wait", "lab_test", "treatment"]
                        .map((k) => getTatSeconds(row, k))
                        .filter((v) => v != null)
                        .reduce((sum, v) => sum + v, 0)
                    )}
                  </td>
                  <td>
                    <span className={`status-chip status-${String(row.status).toLowerCase()}`}>
                      {row.status}
                    </span>
                  </td>
                  <td
                    className="token-actions-cell"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="action-group" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => openConsultStartModal(row)}
                        disabled={isSubmitting || row.status !== "WAITING"}
                        title="Start Consulting"
                        aria-label="Start Consulting"
                      >
                        <span className="action-icon">SC</span>
                      </button>
                      {row.status === "CONSULTING" && !row.consult_end ? (
                        <button
                          type="button"
                          onClick={() => openConfirmAction(row.token_id, "end_consult")}
                          disabled={isSubmitting}
                          title="End Consulting"
                          aria-label="End Consulting"
                        >
                          <span className="action-icon">EC</span>
                        </button>
                      ) : null}
                      {row.status === "CONSULTING" && row.consult_end ? (
                        <button
                          type="button"
                          onClick={() => openConfirmAction(row.token_id, "start_treatment")}
                          disabled={isSubmitting}
                          title="Start Treatment"
                          aria-label="Start Treatment"
                        >
                          <span className="action-icon">ST</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openConfirmAction(row.token_id, "end_treatment")}
                        disabled={isSubmitting || row.status !== "IN_TREATMENT"}
                        title="End Treatment"
                        aria-label="End Treatment"
                      >
                        <span className="action-icon">ET</span>
                      </button>
                      <button
                        type="button"
                        className="action-back"
                        onClick={() => openRevertModal(row)}
                        disabled={
                          isSubmitting ||
                          row.status === "WAITING" ||
                          !canRevertVisit(row)
                        }
                        title="Revert to an earlier journey step"
                        aria-label="Revert to an earlier journey step"
                      >
                        <span className="action-icon" aria-hidden>
                          ←
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ) : null}

      <RevertConfirmModal
        row={stepBackRow}
        onClose={closeRevertModal}
        onConfirm={executeRevert}
        isSubmitting={isSubmitting}
      />

      {consultStartModal.tokenId ? (
        <section className="modal-overlay">
          <article className="modal-card consult-modal">
            <div className="consult-modal-header">
              <h3>Start Consulting</h3>
            </div>
            <div className="consult-modal-form">
              <label htmlFor="consult_department">Select department</label>
              <select
                id="consult_department"
                value={consultStartModal.department}
                onChange={(event) =>
                  setConsultStartModal((prev) => ({ ...prev, department: event.target.value }))
                }
              >
                <option value="">Select department</option>
                {consultDepartmentOptions.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
              <div className="consult-modal-actions">
                <button type="button" onClick={handleStartConsulting} disabled={isSubmitting}>
                  Yes, Start
                </button>
                <button type="button" className="btn-secondary" onClick={closeConsultStartModal}>
                  Cancel
                </button>
              </div>
            </div>
          </article>
        </section>
      ) : null}

      {confirmAction.tokenId ? (
        <section className="modal-overlay">
          <article className="modal-card consult-modal">
            <div className="consult-modal-header">
              <h3>Confirm Action</h3>
            </div>
            <div className="consult-modal-form">
              <p className="confirm-text">
                {confirmAction.action === "end_consult"
                  ? "Are you sure you want to end consulting?"
                  : confirmAction.action === "start_treatment"
                    ? "Are you sure you want to start treatment?"
                    : confirmAction.action === "complete_visit"
                      ? "Complete this visit with consultation only (no treatment)?"
                      : "Are you sure you want to end treatment?"}
              </p>
              {confirmAction.action === "end_consult" ? (
                <label className="end-consult-labs-label">
                  <input
                    type="checkbox"
                    checked={Boolean(confirmAction.labsOrdered)}
                    onChange={(event) =>
                      setConfirmAction((prev) => ({ ...prev, labsOrdered: event.target.checked }))
                    }
                  />
                  Labs / tests ordered — billing and lab steps required before treatment
                </label>
              ) : null}
              <div className="consult-modal-actions">
                <button type="button" onClick={handleConfirmAction} disabled={isSubmitting}>
                  Yes, Confirm
                </button>
                <button type="button" className="btn-secondary" onClick={closeConfirmAction}>
                  Cancel
                </button>
              </div>
            </div>
          </article>
        </section>
      ) : null}
    </section>
  );
};
