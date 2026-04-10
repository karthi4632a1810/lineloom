import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchDashboardSummary, fetchDashboardTokens } from "../services/dashboardService";
import {
  endCareRequest,
  endConsultRequest,
  startWaitingRequest,
  startCareRequest,
  startConsultRequest
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

const formatMinutes = (value = null) => (value == null ? "-" : `${value} min`);
const normalizeTokenId = (value = "") => String(value ?? "").replace(/^\/+|\/+$/g, "");

export const DashboardPage = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState(() => getTodayDefaultFilters());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [consultStartModal, setConsultStartModal] = useState({ tokenId: "", department: "" });
  const [confirmAction, setConfirmAction] = useState({ tokenId: "", action: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const departmentOptions = useMemo(
    () => [...new Set(rows.map((row) => row.department).filter(Boolean))],
    [rows]
  );

  const loadDashboard = async () => {
    setIsLoading(true);
    setError("");
    try {
      const [summaryData, tokenRows] = await Promise.all([
        fetchDashboardSummary(filters),
        fetchDashboardTokens(filters)
      ]);
      setSummary(summaryData);
      setRows(tokenRows);
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
    setConsultStartModal({
      tokenId: String(row?.token_id ?? ""),
      department: String(row?.department ?? "")
    });
  };

  const openConfirmAction = (tokenId = "", action = "") => {
    setConfirmAction({ tokenId, action });
  };

  const closeConsultStartModal = () => setConsultStartModal({ tokenId: "", department: "" });
  const closeConfirmAction = () => setConfirmAction({ tokenId: "", action: "" });

  const handleStartConsulting = async () => {
    if (!consultStartModal.tokenId) {
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
        await endConsultRequest(tokenId);
      } else if (action === "start_treatment") {
        await startCareRequest(tokenId);
      } else if (action === "end_treatment") {
        await endCareRequest(tokenId);
      } else if (action === "revert_waiting") {
        await startWaitingRequest(tokenId);
      }
      closeConfirmAction();
      await loadDashboard();
    } catch (actionError) {
      setError(actionError?.message ?? "Unable to update token state");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page">
      <h2>Patient Queue Dashboard</h2>
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
                  <td>{formatMinutes(row.waiting_tat_minutes)}</td>
                  <td>
                    <div className="tat-cell">
                      <strong>{formatMinutes(row.consulting_tat_minutes)}</strong>
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
                      <strong>{formatMinutes(row.treatment_tat_minutes)}</strong>
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
                  <td>{formatMinutes(row.overall_tat_minutes)}</td>
                  <td>
                    <span className={`status-chip status-${String(row.status).toLowerCase()}`}>
                      {row.status}
                    </span>
                  </td>
                  <td onClick={(event) => event.stopPropagation()}>
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
                      <button
                        type="button"
                        onClick={() => openConfirmAction(row.token_id, "end_consult")}
                        disabled={isSubmitting || row.status !== "CONSULTING"}
                        title="End Consulting"
                        aria-label="End Consulting"
                      >
                        <span className="action-icon">EC</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openConfirmAction(row.token_id, "start_treatment")}
                        disabled={isSubmitting || row.status === "COMPLETED"}
                        title="Start Treatment"
                        aria-label="Start Treatment"
                      >
                        <span className="action-icon">ST</span>
                      </button>
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
                        onClick={() => openConfirmAction(row.token_id, "revert_waiting")}
                        disabled={isSubmitting}
                        title="Move back to waiting"
                        aria-label="Move back to waiting"
                      >
                        <span className="action-icon">RW</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ) : null}

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
                {departmentOptions.map((department) => (
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
                    : confirmAction.action === "end_treatment"
                      ? "Are you sure you want to end treatment?"
                      : "Are you sure you want to move this token back to waiting?"}
              </p>
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
