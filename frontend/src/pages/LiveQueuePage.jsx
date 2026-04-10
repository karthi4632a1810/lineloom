import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StepBackConfirmModal } from "../components/StepBackConfirmModal";
import { fetchActiveDepartments } from "../services/departmentService";
import { getStepBackPreview } from "../utils/stepBackPreview";
import {
  endCareRequest,
  endConsultRequest,
  fetchLiveQueue,
  startCareRequest,
  startConsultRequest,
  stepBackRequest
} from "../services/tokenService";

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

export const LiveQueuePage = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestError, setRequestError] = useState("");
  const [consultStartModal, setConsultStartModal] = useState({ tokenId: "", department: "" });
  const [confirmAction, setConfirmAction] = useState({ tokenId: "", action: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [departmentCatalog, setDepartmentCatalog] = useState([]);
  const [stepBackRow, setStepBackRow] = useState(null);

  const consultDepartmentOptions = useMemo(
    () => departmentCatalog.map((d) => d.name).filter(Boolean),
    [departmentCatalog]
  );

  useEffect(() => {
    fetchActiveDepartments()
      .then((list) => setDepartmentCatalog(Array.isArray(list) ? list : []))
      .catch(() => setDepartmentCatalog([]));
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
    setConfirmAction({ tokenId, action });
  };

  const closeConsultStartModal = () => setConsultStartModal({ tokenId: "", department: "" });
  const closeConfirmAction = () => setConfirmAction({ tokenId: "", action: "" });

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
      }
      closeConfirmAction();
      await loadQueue();
    } catch (actionError) {
      setRequestError(actionError?.message ?? "Unable to update token state");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openStepBackModal = (row = null) => {
    if (!getStepBackPreview(row).canStep) {
      return;
    }
    setStepBackRow(row);
  };

  const closeStepBackModal = () => setStepBackRow(null);

  const executeStepBack = async (tokenId = "") => {
    if (!tokenId) {
      return;
    }
    setIsSubmitting(true);
    setRequestError("");
    try {
      await stepBackRequest(tokenId);
      setStepBackRow(null);
      await loadQueue();
    } catch (actionError) {
      setRequestError(actionError?.message ?? "Unable to step back");
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
                <th>Patient ID</th>
                <th>Name</th>
                <th>Phone</th>
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
                  <td>{row.phone || "—"}</td>
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
                        disabled={
                          isSubmitting ||
                          row.status !== "CONSULTING" ||
                          !row.consult_end
                        }
                        title={
                          row.status === "CONSULTING" && !row.consult_end
                            ? "End consultation before starting treatment"
                            : "Start Treatment"
                        }
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
                        className="action-back"
                        onClick={() => openStepBackModal(row)}
                        disabled={
                          isSubmitting ||
                          row.status === "WAITING" ||
                          !getStepBackPreview(row).canStep
                        }
                        title="Step back one stage"
                        aria-label="Step back one stage"
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

      <StepBackConfirmModal
        row={stepBackRow}
        onClose={closeStepBackModal}
        onConfirm={executeStepBack}
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
                    : "Are you sure you want to end treatment?"}
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
