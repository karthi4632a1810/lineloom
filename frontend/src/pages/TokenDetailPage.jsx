import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAsyncData } from "../hooks/useAsyncData";
import { RevertConfirmModal } from "../components/RevertConfirmModal";
import { fetchActiveDepartments } from "../services/departmentService";
import {
  completeVisitAfterConsultRequest,
  endCareRequest,
  endConsultRequest,
  endLabRequest,
  fetchTokenDetail,
  recordBillingPaymentRequest,
  startCareRequest,
  startConsultRequest,
  startLabRequest,
  revertTokenRequest
} from "../services/tokenService";
import { fetchTokenJourney } from "../services/journeyService";
import { resolveEffectiveTreatmentStart } from "../utils/tatSegments";
import { canRevertVisit, getVisitPhaseChipClass, getVisitPhaseLabel } from "../utils/revertAnchors";

const formatDateTime = (value = null) => {
  if (!value) {
    return "--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return date.toLocaleString();
};

const toSecondsFromMinutes = (value = null) => {
  if (value == null) {
    return null;
  }
  return Math.max(0, Math.round(Number(value) * 60));
};

const toSecondsFromRange = (start = null, end = null, nowMs = Date.now()) => {
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

const getDetailTatSeconds = (tracking = {}, status = "WAITING", metrics = {}, key = "waiting", nowMs = Date.now()) => {
  if (key === "waiting") {
    return (
      toSecondsFromRange(
        tracking.waiting_start,
        tracking.consult_start ?? (status === "WAITING" ? null : tracking.consult_start),
        nowMs
      ) ?? toSecondsFromMinutes(metrics.waiting_time_minutes)
    );
  }
  if (key === "consult") {
    return (
      toSecondsFromRange(
        tracking.consult_start,
        tracking.consult_end ?? (status === "CONSULTING" ? null : tracking.consult_end),
        nowMs
      ) ?? toSecondsFromMinutes(metrics.consult_time_minutes)
    );
  }
  if (key === "treatment") {
    const start = resolveEffectiveTreatmentStart(tracking.care_start, tracking.consult_end);
    if (!start) {
      return null;
    }
    return (
      toSecondsFromRange(
        start,
        tracking.care_end ?? (status === "IN_TREATMENT" ? null : tracking.care_end),
        nowMs
      ) ?? toSecondsFromMinutes(metrics.care_time_minutes)
    );
  }
  if (key === "billing") {
    if (!tracking.billing_start) {
      return null;
    }
    return (
      toSecondsFromRange(
        tracking.billing_start,
        tracking.billing_end ?? (status === "CONSULTING" && !tracking.billing_end ? null : tracking.billing_end),
        nowMs
      ) ?? toSecondsFromMinutes(metrics.billing_time_minutes)
    );
  }
  if (key === "lab_wait") {
    if (!tracking.billing_end) {
      return null;
    }
    return (
      toSecondsFromRange(
        tracking.billing_end,
        tracking.lab_start ?? (status === "CONSULTING" && !tracking.lab_start ? null : tracking.lab_start),
        nowMs
      ) ?? toSecondsFromMinutes(metrics.lab_wait_time_minutes)
    );
  }
  if (key === "lab_test") {
    if (!tracking.lab_start) {
      return null;
    }
    return (
      toSecondsFromRange(
        tracking.lab_start,
        tracking.lab_end ?? (status === "CONSULTING" && !tracking.lab_end ? null : tracking.lab_end),
        nowMs
      ) ?? toSecondsFromMinutes(metrics.lab_test_time_minutes)
    );
  }
  return null;
};

const detailToRevertRow = (token = {}, tracking = {}) => ({
  token_id: token.token_id,
  status: token.status,
  department: token.department,
  consult_start: tracking.consult_start,
  consult_end: tracking.consult_end,
  billing_start: tracking.billing_start,
  billing_end: tracking.billing_end,
  lab_start: tracking.lab_start,
  lab_end: tracking.lab_end,
  care_start: tracking.care_start,
  care_end: tracking.care_end,
  treatment_start: tracking.care_start,
  treatment_end: tracking.care_end
});

export const TokenDetailPage = () => {
  const { tokenId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const resolvedTokenId = useMemo(() => {
    const fromParam = String(tokenId ?? "").replace(/^\/+|\/+$/g, "");
    if (fromParam) {
      return fromParam;
    }
    const parts = String(location?.pathname ?? "")
      .split("/")
      .filter(Boolean);
    const last = parts.length ? String(parts[parts.length - 1]) : "";
    return last.replace(/^\/+|\/+$/g, "");
  }, [tokenId, location?.pathname]);

  const fetcher = useMemo(() => () => fetchTokenDetail(resolvedTokenId), [resolvedTokenId]);
  const { data, isLoading, error, reload } = useAsyncData(fetcher, [fetcher]);

  const journeyFetcher = useMemo(
    () => () => {
      if (!resolvedTokenId) {
        return Promise.resolve(null);
      }
      return fetchTokenJourney(resolvedTokenId);
    },
    [resolvedTokenId]
  );
  const {
    data: journeyPayload,
    isLoading: journeyLoading,
    error: journeyError,
    reload: reloadJourney
  } = useAsyncData(journeyFetcher, [journeyFetcher]);

  const refreshTokenViews = useCallback(async () => {
    await reload();
    await reloadJourney();
  }, [reload, reloadJourney]);

  const [actionError, setActionError] = useState("");
  const [isActing, setIsActing] = useState(false);
  const [departmentCatalog, setDepartmentCatalog] = useState([]);
  const [consultDept, setConsultDept] = useState("");
  const [showConsultModal, setShowConsultModal] = useState(false);
  const [showEndConsultConfirm, setShowEndConsultConfirm] = useState(false);
  const [endConsultLabsOrdered, setEndConsultLabsOrdered] = useState(false);
  const [showCompleteVisitConfirm, setShowCompleteVisitConfirm] = useState(false);
  const [stepBackRow, setStepBackRow] = useState(null);

  useEffect(() => {
    fetchActiveDepartments()
      .then((list) => setDepartmentCatalog(Array.isArray(list) ? list : []))
      .catch(() => setDepartmentCatalog([]));
  }, []);

  const consultDepartmentOptions = useMemo(
    () => departmentCatalog.map((d) => d.name).filter(Boolean),
    [departmentCatalog]
  );

  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const onRefresh = (event) => {
      const id = event.detail?.tokenId;
      if (id != null && String(id) === String(resolvedTokenId)) {
        refreshTokenViews();
      }
    };
    window.addEventListener("lineloom-token-refresh", onRefresh);
    return () => window.removeEventListener("lineloom-token-refresh", onRefresh);
  }, [resolvedTokenId, refreshTokenViews]);

  const queueRowForRevert = useMemo(() => {
    const t = data?.token;
    const tr = data?.tracking ?? {};
    if (!t) {
      return null;
    }
    return detailToRevertRow(t, tr);
  }, [data]);

  const revertAllowed = useMemo(
    () => (queueRowForRevert ? canRevertVisit(queueRowForRevert) : false),
    [queueRowForRevert]
  );

  if (isLoading) {
    return <section className="page">Loading token timeline...</section>;
  }
  if (error) {
    const isNotFound = String(error ?? "")
      .toLowerCase()
      .includes("token not found");
    return (
      <section className="page">
        <p className="error-text">{error}</p>
        <div className="action-group">
          <button type="button" onClick={reload}>
            Retry
          </button>
          {isNotFound ? (
            <button type="button" onClick={() => navigate("/tokens/T-SFD-001")}>
              Open Seed Token
            </button>
          ) : null}
        </div>
      </section>
    );
  }
  if (!data?.token) {
    if (!resolvedTokenId) {
      return <section className="page">Invalid token URL. Open token detail from dashboard row.</section>;
    }
    return <section className="page">No token detail found.</section>;
  }

  const metrics = data.metrics ?? {};
  const tracking = data.tracking ?? {};
  const token = data.token ?? {};
  const patient = data.patient ?? {};
  const waitingSeconds = getDetailTatSeconds(tracking, token.status, metrics, "waiting", nowMs);
  const consultSeconds = getDetailTatSeconds(tracking, token.status, metrics, "consult", nowMs);
  const billingSeconds = getDetailTatSeconds(tracking, token.status, metrics, "billing", nowMs);
  const labWaitSeconds = getDetailTatSeconds(tracking, token.status, metrics, "lab_wait", nowMs);
  const labTestSeconds = getDetailTatSeconds(tracking, token.status, metrics, "lab_test", nowMs);
  const treatmentSeconds = getDetailTatSeconds(tracking, token.status, metrics, "treatment", nowMs);
  const overallSeconds = ["waiting", "consult", "billing", "lab_wait", "lab_test", "treatment"]
    .map((k) => getDetailTatSeconds(tracking, token.status, metrics, k, nowMs))
    .filter((v) => v != null)
    .reduce((sum, v) => sum + v, 0);
  const consultStartedAt = formatDateTime(tracking.consult_start);
  const consultDurationLabel = !tracking.consult_start
    ? "--"
    : !tracking.consult_end
      ? `${formatSeconds(consultSeconds)} elapsed`
      : formatSeconds(consultSeconds);
  const treatmentStartedAt = formatDateTime(tracking.care_start);
  const treatmentDurationLabel = !tracking.care_start
    ? "--"
    : !tracking.care_end
      ? `${formatSeconds(treatmentSeconds)} elapsed`
      : formatSeconds(treatmentSeconds);
  const billingDurationLabel = !tracking.billing_start
    ? "--"
    : !tracking.billing_end
      ? `${formatSeconds(billingSeconds)} elapsed`
      : formatSeconds(billingSeconds);
  const labWaitDurationLabel = !tracking.billing_end
    ? "--"
    : !tracking.lab_start
      ? `${formatSeconds(labWaitSeconds)} elapsed`
      : formatSeconds(labWaitSeconds);
  const labTestDurationLabel = !tracking.lab_start
    ? "--"
    : !tracking.lab_end
      ? `${formatSeconds(labTestSeconds)} elapsed`
      : formatSeconds(labTestSeconds);

  const visitPhaseRow = detailToRevertRow(token, tracking);
  const visitPhaseLabel = getVisitPhaseLabel(visitPhaseRow);
  const visitPhaseChipClass = getVisitPhaseChipClass(visitPhaseRow);

  const timeline = [
    { label: "Admission", time: formatDateTime(token.created_at), done: true },
    {
      label: "Waiting Pool",
      time: tracking.waiting_start ? formatDateTime(tracking.waiting_start) : "--",
      done: Boolean(tracking.waiting_start)
    },
    {
      label: "Consulting",
      time: tracking.consult_start ? formatDateTime(tracking.consult_start) : "--",
      done: Boolean(tracking.consult_start),
      active: token.status === "CONSULTING" && !tracking.consult_end
    },
    ...(tracking.billing_start
      ? [
          {
            label: "Billing / payment",
            time: tracking.billing_end ? formatDateTime(tracking.billing_end) : "--",
            done: Boolean(tracking.billing_end),
            active: token.status === "CONSULTING" && Boolean(tracking.billing_start) && !tracking.billing_end
          },
          {
            label: "Lab waiting",
            time: tracking.lab_start ? formatDateTime(tracking.lab_start) : "--",
            done: Boolean(tracking.lab_start),
            active:
              token.status === "CONSULTING" &&
              Boolean(tracking.billing_end) &&
              !tracking.lab_start
          },
          {
            label: "Lab testing",
            time: tracking.lab_end ? formatDateTime(tracking.lab_end) : "--",
            done: Boolean(tracking.lab_end),
            active: token.status === "CONSULTING" && Boolean(tracking.lab_start) && !tracking.lab_end
          }
        ]
      : []),
    {
      label: "Treatment",
      time: tracking.care_start ? formatDateTime(tracking.care_start) : "--",
      done: Boolean(tracking.care_start),
      active: token.status === "IN_TREATMENT"
    },
    {
      label: "Completed / Discharge",
      time: tracking.care_end ? formatDateTime(tracking.care_end) : "--",
      done: token.status === "COMPLETED"
    }
  ];

  const journeyFromApi =
    journeyPayload?.timeline?.length && !journeyError
      ? journeyPayload.timeline.map((seg) => ({
          label: seg.label,
          timePrimary: seg.in_progress
            ? "In progress"
            : seg.duration_minutes != null
              ? `${seg.duration_minutes} min`
              : "--",
          timeSecondary: `${formatDateTime(seg.start)}${seg.end ? ` → ${formatDateTime(seg.end)}` : ""}`,
          done: Boolean(seg.end) && !seg.in_progress,
          active: Boolean(seg.in_progress)
        }))
      : null;

  const runTokenAction = async (action = "start_consult") => {
    const id = String(token?.token_id ?? resolvedTokenId ?? "");
    if (!id) {
      return;
    }
    if (action === "start_consult") {
      const rowDept = String(token?.department ?? "").trim();
      const initial = consultDepartmentOptions.includes(rowDept) ? rowDept : "";
      setConsultDept(initial);
      setShowConsultModal(true);
      return;
    }
    if (action === "end_consult") {
      setEndConsultLabsOrdered(false);
      setShowEndConsultConfirm(true);
      return;
    }
    if (action === "complete_visit") {
      setShowCompleteVisitConfirm(true);
      return;
    }
    setActionError("");
    setIsActing(true);
    try {
      if (action === "start_treatment") {
        await startCareRequest(id);
      } else if (action === "end_treatment") {
        await endCareRequest(id);
      } else if (action === "record_payment") {
        await recordBillingPaymentRequest(id);
      } else if (action === "start_lab") {
        await startLabRequest(id);
      } else if (action === "end_lab") {
        await endLabRequest(id);
      }
      await refreshTokenViews();
      window.dispatchEvent(new CustomEvent("lineloom-token-refresh", { detail: { tokenId: id } }));
    } catch (requestError) {
      setActionError(requestError?.message ?? "Unable to update token state");
    } finally {
      setIsActing(false);
    }
  };

  const confirmEndConsult = async () => {
    const id = String(token?.token_id ?? resolvedTokenId ?? "");
    if (!id) {
      return;
    }
    setActionError("");
    setIsActing(true);
    try {
      await endConsultRequest(id, { labs_ordered: endConsultLabsOrdered });
      setShowEndConsultConfirm(false);
      setEndConsultLabsOrdered(false);
      await refreshTokenViews();
      window.dispatchEvent(new CustomEvent("lineloom-token-refresh", { detail: { tokenId: id } }));
    } catch (requestError) {
      setActionError(requestError?.message ?? "Unable to end consultation");
    } finally {
      setIsActing(false);
    }
  };

  const confirmCompleteVisit = async () => {
    const id = String(token?.token_id ?? resolvedTokenId ?? "");
    if (!id) {
      return;
    }
    setActionError("");
    setIsActing(true);
    try {
      await completeVisitAfterConsultRequest(id);
      setShowCompleteVisitConfirm(false);
      await refreshTokenViews();
      window.dispatchEvent(new CustomEvent("lineloom-token-refresh", { detail: { tokenId: id } }));
    } catch (requestError) {
      setActionError(requestError?.message ?? "Unable to complete visit");
    } finally {
      setIsActing(false);
    }
  };

  const openRevertModal = () => {
    if (!queueRowForRevert || !revertAllowed) {
      return;
    }
    setStepBackRow(queueRowForRevert);
  };

  const executeRevert = async (id = "", anchor = "") => {
    if (!id || !String(anchor ?? "").trim()) {
      return;
    }
    setActionError("");
    setIsActing(true);
    try {
      await revertTokenRequest(id, anchor);
      setStepBackRow(null);
      await refreshTokenViews();
      window.dispatchEvent(new CustomEvent("lineloom-token-refresh", { detail: { tokenId: id } }));
    } catch (requestError) {
      setActionError(requestError?.message ?? "Unable to revert");
    } finally {
      setIsActing(false);
    }
  };

  const submitStartConsult = async () => {
    const id = String(token?.token_id ?? resolvedTokenId ?? "");
    if (!id) {
      return;
    }
    if (!String(consultDept ?? "").trim()) {
      setActionError("Select a department to start consultation.");
      return;
    }
    setActionError("");
    setIsActing(true);
    try {
      await startConsultRequest(id, { department: consultDept });
      setShowConsultModal(false);
      await refreshTokenViews();
    } catch (requestError) {
      setActionError(requestError?.message ?? "Unable to start consultation");
    } finally {
      setIsActing(false);
    }
  };

  return (
    <section className="page detail-page">
      <header className="detail-header">
        <div className="patient-hero">
          <div className="patient-avatar">
            {(patient?.name ?? token.patient_id ?? "P").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="patient-title-row">
              <h2>{patient?.name ?? `Patient ${token.patient_id}`}</h2>
              <span className="patient-chip">{token.patient_id}</span>
            </div>
            <p className="patient-meta">
              {token.department} Department • Token #{token.visit_id}
            </p>
            <div className="patient-tags">
              <span className={`status-chip ${visitPhaseChipClass}`} title={`API status: ${token.status}`}>
                {visitPhaseLabel}
              </span>
              <span>{patient?.phone ? `Phone ${patient.phone}` : "Phone unavailable"}</span>
            </div>
          </div>
        </div>
        <div className="detail-actions">
          <button
            type="button"
            onClick={() => runTokenAction("start_consult")}
            disabled={isActing || token.status !== "WAITING"}
          >
            Start Consult
          </button>
          <button
            type="button"
            onClick={() => runTokenAction("end_consult")}
            disabled={
              isActing ||
              token.status !== "CONSULTING" ||
              Boolean(tracking.consult_end)
            }
            title="End consultation"
          >
            End Consult
          </button>
          {tracking.billing_start && token.status === "CONSULTING" ? (
            <>
              <button
                type="button"
                onClick={() => runTokenAction("record_payment")}
                disabled={isActing || Boolean(tracking.billing_end)}
                title="Record bill payment"
              >
                Payment done
              </button>
              <button
                type="button"
                onClick={() => runTokenAction("start_lab")}
                disabled={isActing || !tracking.billing_end || Boolean(tracking.lab_start)}
                title="Start lab testing"
              >
                Start lab
              </button>
              <button
                type="button"
                onClick={() => runTokenAction("end_lab")}
                disabled={isActing || !tracking.lab_start || Boolean(tracking.lab_end)}
                title="End lab testing"
              >
                End lab
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => runTokenAction("start_treatment")}
            disabled={
              isActing ||
              token.status !== "CONSULTING" ||
              !tracking.consult_end ||
              (Boolean(tracking.billing_start) && !tracking.lab_end)
            }
            title={
              token.status === "CONSULTING" && !tracking.consult_end
                ? "End consultation before starting treatment"
                : tracking.billing_start && !tracking.lab_end
                  ? "Finish lab workflow before starting treatment"
                  : undefined
            }
          >
            Start Treatment
          </button>
          <button
            type="button"
            className="btn-complete-visit"
            onClick={() => runTokenAction("complete_visit")}
            disabled={
              isActing ||
              token.status !== "CONSULTING" ||
              !tracking.consult_end ||
              Boolean(tracking.care_start) ||
              (Boolean(tracking.billing_start) && !tracking.lab_end)
            }
            title="Finish visit without treatment (consultation only)"
          >
            Complete visit
          </button>
          <button
            type="button"
            onClick={() => runTokenAction("end_treatment")}
            disabled={isActing || token.status !== "IN_TREATMENT"}
          >
            End Treatment
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={openRevertModal}
            disabled={isActing || token.status === "WAITING" || !revertAllowed}
            title="Revert to an earlier journey step"
          >
            Revert
          </button>
        </div>
      </header>
      {actionError ? <p className="error-text">{actionError}</p> : null}

      {showConsultModal ? (
        <section className="modal-overlay">
          <article className="modal-card consult-modal">
            <div className="consult-modal-header">
              <h3>Start Consulting</h3>
            </div>
            <div className="consult-modal-form">
              <label htmlFor="detail_consult_department">Department</label>
              <select
                id="detail_consult_department"
                value={consultDept}
                onChange={(event) => setConsultDept(event.target.value)}
              >
                <option value="">Select department</option>
                {consultDepartmentOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <div className="consult-modal-actions">
                <button type="button" onClick={submitStartConsult} disabled={isActing}>
                  {isActing ? "Starting…" : "Start"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowConsultModal(false)}
                  disabled={isActing}
                >
                  Cancel
                </button>
              </div>
            </div>
          </article>
        </section>
      ) : null}

      {showEndConsultConfirm ? (
        <section className="modal-overlay">
          <article className="modal-card consult-modal">
            <div className="consult-modal-header">
              <h3>End consultation</h3>
            </div>
            <div className="consult-modal-form">
              <p className="confirm-text">Are you sure you want to end consulting for this visit?</p>
              <label className="end-consult-labs-label">
                <input
                  type="checkbox"
                  checked={endConsultLabsOrdered}
                  onChange={(event) => setEndConsultLabsOrdered(event.target.checked)}
                />
                Labs / tests ordered — patient must pay at billing before lab (starts billing timer)
              </label>
              <div className="consult-modal-actions">
                <button type="button" onClick={confirmEndConsult} disabled={isActing}>
                  {isActing ? "Working…" : "Yes, end consult"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowEndConsultConfirm(false)}
                  disabled={isActing}
                >
                  Cancel
                </button>
              </div>
            </div>
          </article>
        </section>
      ) : null}

      {showCompleteVisitConfirm ? (
        <section className="modal-overlay">
          <article className="modal-card consult-modal">
            <div className="consult-modal-header">
              <h3>Complete visit</h3>
            </div>
            <div className="consult-modal-form">
              <p className="confirm-text">
                Mark this visit as finished with consultation only (no treatment phase)?
              </p>
              <div className="consult-modal-actions">
                <button type="button" onClick={confirmCompleteVisit} disabled={isActing}>
                  {isActing ? "Working…" : "Yes, complete visit"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCompleteVisitConfirm(false)}
                  disabled={isActing}
                >
                  Cancel
                </button>
              </div>
            </div>
          </article>
        </section>
      ) : null}

      <RevertConfirmModal
        row={stepBackRow}
        onClose={() => setStepBackRow(null)}
        onConfirm={executeRevert}
        isSubmitting={isActing}
      />

      <div className="detail-grid">
        <div className="detail-main">
          <section className="detail-stats">
            <article className="card">
              <p>Total Wait Time</p>
              <div className="detail-stat-metric">{formatSeconds(waitingSeconds)}</div>
            </article>
            <article className="card">
              <p>Consulting Since</p>
              <div className="detail-stat-datetime">{consultStartedAt}</div>
              <small>{consultDurationLabel}</small>
            </article>
            {tracking.billing_start ? (
              <>
                <article className="card">
                  <p>Billing time</p>
                  <div className="detail-stat-datetime">{formatDateTime(tracking.billing_start)}</div>
                  <small>{billingDurationLabel}</small>
                </article>
                <article className="card">
                  <p>Lab waiting</p>
                  <div className="detail-stat-datetime">
                    {tracking.billing_end ? formatDateTime(tracking.billing_end) : "--"}
                  </div>
                  <small>{labWaitDurationLabel}</small>
                </article>
                <article className="card">
                  <p>Lab testing</p>
                  <div className="detail-stat-datetime">
                    {tracking.lab_start ? formatDateTime(tracking.lab_start) : "--"}
                  </div>
                  <small>{labTestDurationLabel}</small>
                </article>
              </>
            ) : null}
            <article className="card">
              <p>Treatment Since</p>
              <div className="detail-stat-datetime">{treatmentStartedAt}</div>
              <small>{treatmentDurationLabel}</small>
            </article>
            <article className="card">
              <p>Estimated TAT</p>
              <div className="detail-stat-metric">{formatSeconds(overallSeconds)}</div>
            </article>
          </section>

          <section className="card">
            <h3>Patient Vitals Summary</h3>
            <div className="vitals-grid">
              <div className="vital-card">
                <p>Heart Rate</p>
                <h4>78 BPM</h4>
              </div>
              <div className="vital-card">
                <p>BP</p>
                <h4>120/80 mmHg</h4>
              </div>
              <div className="vital-card">
                <p>Temp</p>
                <h4>98.6 F</h4>
              </div>
              <div className="vital-card">
                <p>SpO2</p>
                <h4>99%</h4>
              </div>
            </div>
          </section>

          <section className="card">
            <h3>Clinical Notes &amp; Observations</h3>
            <textarea
              readOnly
              value={tracking.consult_note || "No clinical notes entered yet."}
            />
          </section>
        </div>

        <aside className="detail-side">
          <section className="card">
            <h3>Patient Journey</h3>
            {journeyLoading ? <p className="muted-inline">Updating timeline…</p> : null}
            {journeyError ? <p className="error-text">{journeyError}</p> : null}
            <div className="journey-list">
              {(journeyFromApi ?? timeline).map((step, index) => (
                <div
                  key={`${step.label}-${index}`}
                  className={`journey-step ${step.active ? "active" : ""}`}
                >
                  <span className={`dot ${step.done ? "done" : ""}`}>{step.done ? "✓" : ""}</span>
                  <div className="journey-step-body">
                    <strong>{step.label}</strong>
                    <p className="journey-step-time">{step.timePrimary ?? step.time}</p>
                    {step.timeSecondary ? (
                      <p className="journey-step-sub">{step.timeSecondary}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="card">
            <h3>Urgent Actions</h3>
            <div className="urgent-list">
              <button type="button">Order Lab Tests</button>
              <button type="button">Prescribe E-Rx</button>
              <button type="button">Rapid Response Team</button>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
};
