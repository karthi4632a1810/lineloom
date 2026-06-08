import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClinicalPageHeader } from "../components/clinical/PagePrimitives.jsx";
import { QueuePatientCard } from "../components/queue/QueuePatientCard.jsx";
import { RevertConfirmModal } from "../components/RevertConfirmModal";
import { fetchActiveDepartments } from "../services/departmentService";
import { canRevertVisit } from "../utils/revertAnchors";
import { fetchHisDepartments } from "../services/dashboardService";
import {
  completeVisitAfterConsultRequest,
  endCareRequest,
  endConsultRequest,
  fetchLiveQueue,
  startCareRequest,
  startConsultRequest,
  revertTokenRequest
} from "../services/tokenService";
import { resolveEffectiveTreatmentStart } from "../utils/tatSegments";
import { goToTokenDetail } from "../utils/tokenPaths.js";

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "WAITING", label: "Waiting" },
  { value: "CONSULTING", label: "Consulting" },
  { value: "IN_TREATMENT", label: "In treatment" }
];

export const LiveQueuePage = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedDepartment, setAppliedDepartment] = useState("General Medicine");
  const [statusFilter, setStatusFilter] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestError, setRequestError] = useState("");
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

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const consultDepartmentOptions = useMemo(
    () => [
      ...new Set(
        [
          ...hisDepartments.map((department) => String(department?.dept_name ?? "").trim()),
          ...departmentCatalog.map((department) => String(department?.name ?? "").trim())
        ].filter(Boolean)
      )
    ].sort((a, b) => a.localeCompare(b)),
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

  const loadQueue = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await fetchLiveQueue({
        search: appliedSearch,
        department: appliedDepartment
      });
      setRows(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError?.message ?? "Failed to load live queue");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [appliedSearch, appliedDepartment]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const visibleRows = useMemo(() => {
    if (!appliedStatus) {
      return rows;
    }
    return rows.filter((row) => String(row.status ?? "").toUpperCase() === appliedStatus);
  }, [rows, appliedStatus]);

  const handleApplySearch = (event) => {
    event.preventDefault();
    setAppliedSearch(searchInput.trim());
    setAppliedStatus(statusFilter);
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
      setRequestError("Select a department to start consultation.");
      return;
    }
    setIsSubmitting(true);
    setRequestError("");
    try {
      await startConsultRequest(consultStartModal.tokenId, {
        department: consultStartModal.department
      });
      closeConsultStartModal();
      await loadQueue();
    } catch (actionError) {
      setRequestError(actionError?.message ?? "Unable to start consulting");
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
    setRequestError("");
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
      await loadQueue();
    } catch (actionError) {
      setRequestError(actionError?.message ?? "Unable to update token state");
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
    setRequestError("");
    try {
      await revertTokenRequest(tokenId, anchor);
      setStepBackRow(null);
      await loadQueue();
    } catch (actionError) {
      setRequestError(actionError?.message ?? "Unable to revert");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page cc-page queue-layout-page live-queue-page nf-lq-modern">
      <ClinicalPageHeader
        title="Live queue"
        subtitle="All open tokens (not completed). Search by name, phone, reg no, OP/IP visit number, or token id."
      />

      <div className="nf-stat-grid nf-lq-modern-stats" aria-label="Live queue summary">
        <article className="summary-card nf-stat-card nf-stat-card--waiting">
          <h4>Waiting</h4>
          <p className="nf-stat-value">
            {visibleRows.filter((row) => String(row.status ?? "").toUpperCase() === "WAITING").length}
          </p>
          <span className="nf-stat-caption">in queue</span>
        </article>
        <article className="summary-card nf-stat-card nf-stat-card--consult">
          <h4>Consulting</h4>
          <p className="nf-stat-value">
            {visibleRows.filter((row) => String(row.status ?? "").toUpperCase() === "CONSULTING").length}
          </p>
          <span className="nf-stat-caption">active</span>
        </article>
        <article className="summary-card nf-stat-card nf-stat-card--treatment">
          <h4>In treatment</h4>
          <p className="nf-stat-value">
            {visibleRows.filter((row) => String(row.status ?? "").toUpperCase() === "IN_TREATMENT").length}
          </p>
          <span className="nf-stat-caption">on-site</span>
        </article>
        <article className="summary-card nf-stat-card nf-stat-card--total">
          <h4>Active tokens</h4>
          <p className="nf-stat-value">{visibleRows.length}</p>
          <span className="nf-stat-caption">total shown</span>
        </article>
      </div>

      <form className="nf-lq-toolbar nf-lq-modern-toolbar" onSubmit={handleApplySearch}>
        <div className="nf-panel-head">
          <h2 className="nf-panel-title">Find patients</h2>
          <p className="nf-panel-sub">Filter by search, department, or status (waiting, consulting, in treatment).</p>
        </div>
        <div className="nf-lq-toolbar-fields nf-lq-toolbar-fields--live">
          <div className="nf-lq-field">
            <label htmlFor="lq_search">Search</label>
            <input
              id="lq_search"
              type="search"
              name="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Name, phone, reg no, visit no, token id…"
              className="nf-lq-input"
            />
          </div>
          <div className="nf-lq-field">
            <label htmlFor="lq_dept">Department</label>
            <select
              id="lq_dept"
              name="department_filter"
              value={appliedDepartment}
              onChange={(event) => setAppliedDepartment(event.target.value)}
              className="nf-lq-input"
            >
              <option value="">All departments</option>
              {consultDepartmentOptions.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </div>
          <div className="nf-lq-field">
            <label htmlFor="lq_status">Status</label>
            <select
              id="lq_status"
              name="status_filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="nf-lq-input"
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="nf-lq-toolbar-actions">
          <button type="submit" className="nf-lq-btn nf-lq-btn--primary" disabled={isSubmitting}>
            {isSubmitting ? "Searching…" : "Apply filters"}
          </button>
        </div>
      </form>

      {error ? <p className="error-text">{error}</p> : null}
      {requestError ? <p className="error-text">{requestError}</p> : null}
      {isLoading ? <p className="muted-inline">Loading live queue…</p> : null}

      {!isLoading && !error && !visibleRows.length ? (
        <p className="muted-inline">
          {appliedSearch || appliedDepartment || appliedStatus
            ? "No tokens match your current filters."
            : "No active tokens in queue."}
        </p>
      ) : null}

      {!isLoading && visibleRows.length ? (
        <div className="nf-lq-modern-queue-panel">
          <div className="nf-lq-list-head">
            <div>
              <h2>Active queue</h2>
              <p>Click a card to open the full visit. Use actions for workflow steps.</p>
            </div>
            <p>
              <strong>{visibleRows.length}</strong>
              {rows.length !== visibleRows.length ? ` of ${rows.length}` : ""} token
              {visibleRows.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="nf-lq-list">
            {visibleRows.map((row) => (
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
                onCompleteVisit={(r) => openConfirmAction(r.token_id, "complete_visit")}
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
              <label htmlFor="live_consult_department">Select department</label>
              <select
                id="live_consult_department"
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
