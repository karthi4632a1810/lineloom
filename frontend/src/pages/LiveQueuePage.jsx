import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

export const LiveQueuePage = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
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

  const loadQueue = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await fetchLiveQueue({ search: appliedSearch });
      setRows(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError?.message ?? "Failed to load live queue");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [appliedSearch]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleApplySearch = (event) => {
    event.preventDefault();
    setAppliedSearch(searchInput.trim());
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
    <section className="page live-queue-page">
      <h2>Live Queue</h2>
      <p className="live-queue-lead">
        All open tokens (not completed), every date. Search matches patient name, phone, patient / reg
        number, OP/IP visit number, or token id.
      </p>

      <form className="card filter-grid live-queue-filters" onSubmit={handleApplySearch}>
        <input
          type="search"
          name="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Name, phone, reg no, OP/IP visit no, token id…"
          className="live-queue-search"
        />
        <button type="submit" disabled={isSubmitting}>
          Search
        </button>
      </form>

      {error ? <p className="error-text">{error}</p> : null}
      {requestError ? <p className="error-text">{requestError}</p> : null}
      {isLoading ? <p>Loading live queue…</p> : null}

      {!isLoading && !error && !rows.length ? (
        <p>
          {appliedSearch
            ? "No tokens match your search. Try different keywords."
            : "No active tokens in queue."}
        </p>
      ) : null}

      {!isLoading && rows.length ? (
        <article className="card table-card">
          <table>
            <thead>
              <tr>
                <th className="col-token-no">Token #</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Department</th>
                <th className="col-tat">Waiting TAT</th>
                <th className="col-tat">Consult TAT</th>
                <th className="col-tat">Treatment TAT</th>
                <th className="col-tat">Overall TAT</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, queueIndex) => (
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
                  <td className="col-token-no">
                    <span className="token-queue-no">#{queueIndex + 1}</span>
                    <span className="token-queue-id" title={row.token_id}>
                      {row.token_id}
                    </span>
                  </td>
                  <td>{row.name}</td>
                  <td>{row.phone || "—"}</td>
                  <td>{row.department}</td>
                  <td className="col-tat">{formatSeconds(getTatSeconds(row, "waiting"))}</td>
                  <td className="col-tat">
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
                  <td className="col-tat">
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
                  <td className="col-tat">
                    {formatSeconds(
                      ["waiting", "consult", "lab_wait", "lab_test", "treatment"]
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
                      {row.status === "CONSULTING" && row.consult_end && !row.treatment_start ? (
                        <button
                          type="button"
                          className="action-complete-visit"
                          onClick={() => openConfirmAction(row.token_id, "complete_visit")}
                          disabled={isSubmitting}
                          title="Complete visit (consult only)"
                          aria-label="Complete visit"
                        >
                          <span className="action-icon">CV</span>
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
