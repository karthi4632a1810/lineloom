import { useEffect, useMemo, useState } from "react";
import { fetchDashboardSummary, fetchDashboardTokens } from "../services/dashboardService";
import {
  endCareRequest,
  endConsultRequest,
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

export const DashboardPage = () => {
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState(() => getTodayDefaultFilters());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTokenId, setSelectedTokenId] = useState("");
  const [consultNote, setConsultNote] = useState("");
  const [nextDepartment, setNextDepartment] = useState("");
  const [treatmentDepartment, setTreatmentDepartment] = useState("");
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

  const handleStartConsulting = async (tokenId = "") => {
    setIsSubmitting(true);
    setError("");
    try {
      await startConsultRequest(tokenId);
      await loadDashboard();
    } catch (actionError) {
      setError(actionError?.message ?? "Unable to start consulting");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndConsulting = async () => {
    if (!selectedTokenId) {
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      await endConsultRequest(selectedTokenId, {
        consult_note: consultNote,
        next_department: nextDepartment
      });
      setSelectedTokenId("");
      setConsultNote("");
      setNextDepartment("");
      await loadDashboard();
    } catch (actionError) {
      setError(actionError?.message ?? "Unable to end consulting");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartTreatment = async (tokenId = "") => {
    if (!treatmentDepartment) {
      setError("Please select treatment department");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      await startCareRequest(tokenId, { department: treatmentDepartment });
      setTreatmentDepartment("");
      await loadDashboard();
    } catch (actionError) {
      setError(actionError?.message ?? "Unable to start treatment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndTreatment = async (tokenId = "") => {
    setIsSubmitting(true);
    setError("");
    try {
      await endCareRequest(tokenId);
      await loadDashboard();
    } catch (actionError) {
      setError(actionError?.message ?? "Unable to end treatment");
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
      {!isLoading && !rows.length ? <p>No patient tokens available for selected range.</p> : null}

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
                <tr key={row.token_id}>
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
                  <td>
                    <div className="action-group">
                      <button
                        type="button"
                        onClick={() => handleStartConsulting(row.token_id)}
                        disabled={isSubmitting || row.status !== "WAITING"}
                        title="Start Consulting"
                        aria-label="Start Consulting"
                      >
                        <span className="action-icon">SC</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTokenId(row.token_id)}
                        disabled={isSubmitting || row.status !== "CONSULTING"}
                        title="End Consulting"
                        aria-label="End Consulting"
                      >
                        <span className="action-icon">EC</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartTreatment(row.token_id)}
                        disabled={isSubmitting || row.status === "COMPLETED"}
                        title="Start Treatment"
                        aria-label="Start Treatment"
                      >
                        <span className="action-icon">ST</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEndTreatment(row.token_id)}
                        disabled={isSubmitting || row.status !== "IN_TREATMENT"}
                        title="End Treatment"
                        aria-label="End Treatment"
                      >
                        <span className="action-icon">ET</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ) : null}

      {selectedTokenId ? (
        <section className="modal-overlay">
          <article className="modal-card">
            <h3>End Consulting</h3>
            <input
              placeholder="Next department (ENT, Cardiology...)"
              value={nextDepartment}
              onChange={(event) => setNextDepartment(event.target.value)}
            />
            <textarea
              placeholder="Consultation note (optional)"
              value={consultNote}
              onChange={(event) => setConsultNote(event.target.value)}
            />
            <div className="action-group">
              <button type="button" onClick={handleEndConsulting} disabled={isSubmitting}>
                Save and End
              </button>
              <button type="button" onClick={() => setSelectedTokenId("")}>
                Cancel
              </button>
            </div>
          </article>
        </section>
      ) : null}

      <article className="card">
        <h4>Start Treatment Department</h4>
        <input
          type="text"
          placeholder="Enter department before clicking start treatment"
          value={treatmentDepartment}
          onChange={(event) => setTreatmentDepartment(event.target.value)}
        />
      </article>
    </section>
  );
};
