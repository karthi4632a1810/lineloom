import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClinicalPageHeader } from "../components/clinical/PagePrimitives.jsx";
import { QueuePatientCard } from "../components/queue/QueuePatientCard.jsx";
import { RevertConfirmModal } from "../components/RevertConfirmModal";
import { fetchActiveDepartments } from "../services/departmentService";
import { resolveEffectiveTreatmentStart } from "../utils/tatSegments";
import { canRevertVisit } from "../utils/revertAnchors";
import {
  fetchDashboardSummary,
  fetchDashboardTokens,
  fetchHisDepartments
} from "../services/dashboardService";
import { fetchAlerts } from "../services/alertService";
import { goToTokenDetail } from "../utils/tokenPaths.js";
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

export const DashboardPage = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState(() => getTodayDefaultFilters());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [consultStartModal, setConsultStartModal] = useState({ tokenId: "", department: "" });
  const [confirmAction, setConfirmAction] = useState({
    tokenId: "",
    action: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [departmentCatalog, setDepartmentCatalog] = useState([]);
  const [hisDepartments, setHisDepartments] = useState([]);
  const [stepBackRow, setStepBackRow] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [quickAlerts, setQuickAlerts] = useState([]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const departmentOptions = useMemo(() => {
    const fromHis = hisDepartments.map((department) => String(department?.dept_name ?? "").trim());
    const fromCatalog = departmentCatalog.map((department) => String(department?.name ?? "").trim());
    const fromRows = rows.map((row) => String(row?.department ?? "").trim());
    return [...new Set([...fromHis, ...fromCatalog, ...fromRows].filter(Boolean))];
  }, [hisDepartments, departmentCatalog, rows]);

  const consultDepartmentOptions = useMemo(
    () => [
      ...new Set(
        [
          ...hisDepartments.map((department) => String(department?.dept_name ?? "").trim()),
          ...departmentCatalog.map((department) => String(department?.name ?? "").trim())
        ].filter(Boolean)
      )
    ],
    [hisDepartments, departmentCatalog]
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
      const inLabPath = Boolean(row.labs_ordered) || row.lab_start || row.lab_end;
      if (!row.consult_end || !inLabPath) {
        return null;
      }
      return (
        toSecondsFromRange(
          row.consult_end,
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
    fetchHisDepartments()
      .then((list) => setHisDepartments(Array.isArray(list) ? list : []))
      .catch(() => setHisDepartments([]));
  }, []);

  const loadDashboard = async () => {
    setIsLoading(true);
    setError("");
    try {
      const [summaryData, tokenRows, alerts] = await Promise.all([
        fetchDashboardSummary(filters),
        fetchDashboardTokens(filters),
        fetchAlerts({ limit: 5, unacknowledged_only: 1 }).catch(() => [])
      ]);
      setSummary(summaryData);
      setRows(tokenRows);
      setQuickAlerts(Array.isArray(alerts) ? alerts : []);
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

  const openConfirmAction = (tokenId = "", action = "") => {
    setConfirmAction({
      tokenId,
      action
    });
  };

  const closeConsultStartModal = () => setConsultStartModal({ tokenId: "", department: "" });
  const closeConfirmAction = () =>
    setConfirmAction({
      tokenId: "",
      action: ""
    });

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
        await endConsultRequest(tokenId);
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
    <section className="page cc-page queue-layout-page nf-overview-page nf-overview-modern">
      <ClinicalPageHeader
        title="Patient queue overview"
        subtitle="Track waiting, consulting, treatment, and completion across departments for the selected date range."
      />

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

      <form className="nf-lq-toolbar nf-overview-toolbar" onSubmit={handleApplyFilters}>
        <div className="nf-panel-head">
          <h2 className="nf-panel-title">Filters</h2>
          <p className="nf-panel-sub">Date range, search, and department for the queue below.</p>
        </div>
        <div className="nf-lq-toolbar-fields nf-lq-toolbar-fields--overview">
          <div className="nf-lq-field">
            <label htmlFor="dash_from">From</label>
            <input
              id="dash_from"
              type="datetime-local"
              name="from"
              value={filters.from}
              onChange={handleFilterChange}
              className="nf-lq-input"
            />
          </div>
          <div className="nf-lq-field">
            <label htmlFor="dash_to">To</label>
            <input
              id="dash_to"
              type="datetime-local"
              name="to"
              value={filters.to}
              onChange={handleFilterChange}
              className="nf-lq-input"
            />
          </div>
          <div className="nf-lq-field">
            <label htmlFor="dash_search">Search</label>
            <input
              id="dash_search"
              type="text"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="Name, token id, visit id"
              className="nf-lq-input"
            />
          </div>
          <div className="nf-lq-field">
            <label htmlFor="dash_dept">Department</label>
            <select
              id="dash_dept"
              name="department"
              value={filters.department}
              onChange={handleFilterChange}
              className="nf-lq-input"
            >
              <option value="">All departments</option>
              {departmentOptions.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="nf-lq-toolbar-actions">
          <button type="submit" className="nf-lq-btn nf-lq-btn--primary" disabled={isSubmitting}>
            {isSubmitting ? "Applying…" : "Apply filters"}
          </button>
        </div>
      </form>

      <div className="nf-stat-grid summary-grid" aria-label="Queue summary">
        <article className="summary-card nf-stat-card nf-stat-card--waiting">
          <h4>Waiting</h4>
          <p className="nf-stat-value">{summary?.waiting_patient_count ?? 0}</p>
          <span className="nf-stat-caption">patients in queue</span>
        </article>
        <article className="summary-card nf-stat-card nf-stat-card--consult">
          <h4>In consult</h4>
          <p className="nf-stat-value">{summary?.patient_in_consulting_count ?? 0}</p>
          <span className="nf-stat-caption">active consultations</span>
        </article>
        <article className="summary-card nf-stat-card nf-stat-card--treatment">
          <h4>In treatment</h4>
          <p className="nf-stat-value">{summary?.patient_in_treatment_count ?? 0}</p>
          <span className="nf-stat-caption">on-site care</span>
        </article>
        <article className="summary-card nf-stat-card nf-stat-card--done">
          <h4>Completed</h4>
          <p className="nf-stat-value">{summary?.patient_completed_count ?? 0}</p>
          <span className="nf-stat-caption">visits finished</span>
        </article>
        <article className="summary-card nf-stat-card nf-stat-card--total">
          <h4>Total today</h4>
          <p className="nf-stat-value">{summary?.total_patients_today ?? 0}</p>
          <span className="nf-stat-caption">tokens in range</span>
        </article>
        <article className="summary-card nf-stat-card nf-stat-card--avg-wait">
          <h4>Avg wait</h4>
          <p className="nf-stat-value">
            {summary?.avg_waiting_time_minutes != null
              ? `${Math.round(summary.avg_waiting_time_minutes)}m`
              : "—"}
          </p>
          <span className="nf-stat-caption">minutes average</span>
        </article>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {isLoading ? <p className="muted-inline">Loading queue…</p> : null}
      {!isLoading && !error && !rows.length ? (
        <p className="muted-inline">No patient tokens available for selected range.</p>
      ) : null}

      {!isLoading && rows.length ? (
        <div className="nf-overview-queue-panel">
          <div className="nf-lq-list-head">
            <div>
              <h2>Patient queue</h2>
              <p>Click a card to open the full visit.</p>
            </div>
            <p>
              <strong>{rows.length}</strong> token{rows.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="nf-lq-list">
            {rows.map((row) => (
              <QueuePatientCard
                key={row.token_id}
                row={row}
                isSubmitting={isSubmitting}
                formatSeconds={formatSeconds}
                getTatSeconds={getTatSeconds}
                canRevert={canRevertVisit(row)}
                onOpenDetail={(r) => goToTokenDetail(navigate, r.token_id)}
                onStartConsult={openConsultStartModal}
                onEndConsult={(r) => openConfirmAction(r.token_id, "end_consult")}
                onStartTreatment={(r) => openConfirmAction(r.token_id, "start_treatment")}
                onEndTreatment={(r) => openConfirmAction(r.token_id, "end_treatment")}
                onRevert={openRevertModal}
              />
            ))}
          </div>
        </div>
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
                <>
                  <div className="consult-modal-actions end-consult-modal-actions">
                    <button type="button" className="btn-secondary" onClick={closeConfirmAction}>
                      Cancel
                    </button>
                    <button type="button" onClick={handleConfirmAction} disabled={isSubmitting}>
                      {isSubmitting ? "Working…" : "End consult"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="consult-modal-actions">
                  <button type="button" onClick={handleConfirmAction} disabled={isSubmitting}>
                    Yes, Confirm
                  </button>
                  <button type="button" className="btn-secondary" onClick={closeConfirmAction}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </article>
        </section>
      ) : null}
    </section>
  );
};
