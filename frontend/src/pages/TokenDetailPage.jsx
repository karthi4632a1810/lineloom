import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAsyncData } from "../hooks/useAsyncData";
import { RevertConfirmModal } from "../components/RevertConfirmModal";
import { fetchActiveDepartments } from "../services/departmentService";
import { fetchHisDepartments } from "../services/dashboardService";
import {
  completeVisitAfterConsultRequest,
  endCareRequest,
  endConsultRequest,
  fetchTokenDetail,
  startCareRequest,
  startConsultRequest,
  revertTokenRequest
} from "../services/tokenService";
import { ClinicalTokenDetailLayout } from "../components/clinical/ClinicalTokenDetailLayout.jsx";
import { buildJourneyStepsFromTracking, mapJourneyStepForDisplay } from "../utils/journeyTimeline.js";
import { overallVisitSeconds, resolveVisitCompletedAt } from "../utils/visitCompletion.js";
import { resolveLabTimes } from "../utils/labTimes";
import { resolvePharmacyTimes } from "../utils/pharmacyTimes";
import { resolveEffectiveTreatmentStart } from "../utils/tatSegments";
import { postConsultLabel } from "../constants/postConsultOptions";
import { canRevertVisit, getVisitPhaseChipClass, getVisitPhaseLabel } from "../utils/revertAnchors";
import { formatDateTimeDisplay } from "../utils/dateTimeDisplay.js";

const formatDateTime = (value = null) => formatDateTimeDisplay(value);

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

const getWorkflowTotalSeconds = (logs = [], activeStart = null, nowMs = Date.now()) => {
  const entries = Array.isArray(logs) ? logs : [];
  let totalMs = 0;
  entries.forEach((entry) => {
    const startMs = entry?.start ? new Date(entry.start).getTime() : NaN;
    if (Number.isNaN(startMs)) {
      return;
    }
    const endMs = entry?.end ? new Date(entry.end).getTime() : NaN;
    const segmentEnd = Number.isNaN(endMs) ? nowMs : endMs;
    totalMs += Math.max(0, segmentEnd - startMs);
  });
  if (!entries.length && activeStart) {
    const startMs = new Date(activeStart).getTime();
    if (!Number.isNaN(startMs)) {
      totalMs += Math.max(0, nowMs - startMs);
    }
  }
  return Math.floor(totalMs / 1000);
};

const getDisplayCurrentStart = (activeStart = null, logs = []) => {
  if (activeStart) {
    return activeStart;
  }
  const entries = Array.isArray(logs) ? logs : [];
  if (!entries.length) {
    return null;
  }
  const last = entries[entries.length - 1];
  return last?.start ?? null;
};

const getLatestLabelPaymentAt = (payments = [], label = "") => {
  const normalizedLabel = String(label ?? "").trim().toLowerCase();
  const list = Array.isArray(payments) ? payments : [];
  const filtered = list.filter(
    (entry) => String(entry?.label ?? "").trim().toLowerCase() === normalizedLabel && entry?.paid_at
  );
  if (!filtered.length) {
    return null;
  }
  return filtered
    .map((entry) => new Date(entry.paid_at))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0];
};

const getLabeledPaymentTimeline = (payments = [], label = "") =>
  (Array.isArray(payments) ? payments : [])
    .filter((entry) => String(entry?.label ?? "").trim().toLowerCase() === String(label).toLowerCase())
    .map((entry) => ({
      ...entry,
      paid_at: entry?.paid_at ? new Date(entry.paid_at) : null
    }))
    .filter((entry) => entry.paid_at && !Number.isNaN(entry.paid_at.getTime()))
    .sort((a, b) => a.paid_at.getTime() - b.paid_at.getTime());

const getLogBounds = (logs = [], fallbackStart = null, fallbackEnd = null) => {
  const entries = Array.isArray(logs) ? logs : [];
  if (!entries.length) {
    return { firstStart: fallbackStart, lastEnd: fallbackEnd };
  }
  const firstStart = entries[0]?.start ?? fallbackStart;
  const closed = entries.filter((entry) => entry?.end);
  const lastEnd = closed.length ? closed[closed.length - 1]?.end : fallbackEnd;
  return { firstStart, lastEnd };
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
    const elapsedMs = Math.max(0, Number(tracking.billing_elapsed_ms ?? 0) || 0);
    const activeMs = tracking.billing_start
      ? Math.max(nowMs - new Date(tracking.billing_start).getTime(), 0)
      : 0;
    const totalMs = elapsedMs + (Number.isNaN(activeMs) ? 0 : activeMs);
    if (totalMs > 0) {
      return Math.floor(totalMs / 1000);
    }
    if (!tracking.billing_start && !tracking.billing_end) {
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
    const inLabPath =
      Boolean(tracking.labs_ordered) || tracking.lab_start || tracking.lab_end;
    if (!tracking.consult_end || !inLabPath) {
      return null;
    }
    const { sampleAt, requestAt } = resolveLabTimes(tracking);
    const labWorkStart = sampleAt ?? requestAt ?? (tracking.lab_start ? new Date(tracking.lab_start) : null);
    return (
      toSecondsFromRange(
        tracking.consult_end,
        labWorkStart ?? (status === "CONSULTING" && !labWorkStart ? null : labWorkStart),
        nowMs
      ) ?? toSecondsFromMinutes(metrics.lab_wait_time_minutes)
    );
  }
  if (key === "lab_test") {
    const { sampleAt, completedAt } = resolveLabTimes(tracking);
    const labTestStart = sampleAt ?? tracking.lab_start;
    if (!labTestStart) {
      return null;
    }
    const labTestEnd =
      completedAt ?? tracking.lab_end ?? (status === "CONSULTING" && !tracking.lab_end ? null : tracking.lab_end);
    return (
      toSecondsFromRange(labTestStart, labTestEnd, nowMs) ??
      toSecondsFromMinutes(metrics.lab_test_time_minutes)
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
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const resolvedTokenId = useMemo(() => {
    const splat = String(params["*"] ?? "").trim();
    if (splat) {
      try {
        return decodeURIComponent(splat.replace(/^\/+|\/+$/g, ""));
      } catch {
        return splat.replace(/^\/+|\/+$/g, "");
      }
    }
    const fromParam = String(params.tokenId ?? "").trim();
    if (fromParam) {
      try {
        return decodeURIComponent(fromParam);
      } catch {
        return fromParam;
      }
    }
    const match = String(location?.pathname ?? "").match(/^\/tokens\/(.+?)\/?$/i);
    if (!match) {
      return "";
    }
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }, [params, location?.pathname]);

  const fetcher = useMemo(() => () => fetchTokenDetail(resolvedTokenId), [resolvedTokenId]);
  const { data, isLoading, error, reload, silentReload } = useAsyncData(fetcher, [fetcher]);

  const refreshTokenViews = useCallback(async () => {
    await reload();
  }, [reload]);

  const [actionError, setActionError] = useState("");
  const [isActing, setIsActing] = useState(false);
  const [departmentCatalog, setDepartmentCatalog] = useState([]);
  const [hisDepartments, setHisDepartments] = useState([]);
  const [consultDept, setConsultDept] = useState("");
  const [showConsultModal, setShowConsultModal] = useState(false);
  const [showEndConsultConfirm, setShowEndConsultConfirm] = useState(false);
  const [showCompleteVisitConfirm, setShowCompleteVisitConfirm] = useState(false);
  const [stepBackRow, setStepBackRow] = useState(null);

  useEffect(() => {
    fetchActiveDepartments()
      .then((list) => setDepartmentCatalog(Array.isArray(list) ? list : []))
      .catch(() => setDepartmentCatalog([]));
    fetchHisDepartments()
      .then((list) => setHisDepartments(Array.isArray(list) ? list : []))
      .catch(() => setHisDepartments([]));
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

  useEffect(() => {
    if (isLoading || !data?.token?.visit_id) {
      return undefined;
    }
    const tr = data.tracking ?? {};
    const payments = Array.isArray(tr.billing_payments) ? tr.billing_payments : [];
    const hasBilling =
      payments.length > 0 ||
      Boolean(tr.billing_end) ||
      Boolean(tr.billing_start) ||
      (Number(tr.billing_elapsed_ms ?? 0) || 0) > 0;
    const { completedAt: labCompletedAt } = resolveLabTimes(tr);
    const { completedAt: pharmacyCompletedAt } = resolvePharmacyTimes(tr);
    const postPlans = Array.isArray(tr.post_consult_plans) ? tr.post_consult_plans : [];
    const inLabPath =
      Boolean(tr.consult_end) &&
      (Boolean(tr.labs_ordered) ||
        tr.lab_start ||
        tr.lab_end ||
        (tr.lab_logs ?? []).length > 0 ||
        postPlans.map((p) => String(p).toLowerCase()).includes("labs"));
    const needsLabRefresh = inLabPath && !labCompletedAt;
    const needsPharmacyRefresh = Boolean(tr.consult_end) && !pharmacyCompletedAt;
    const needsBillingRefresh = Boolean(tr.consult_end) && !hasBilling;
    if (!needsLabRefresh && !needsPharmacyRefresh && !needsBillingRefresh) {
      return undefined;
    }
    const pollMs = needsLabRefresh || needsPharmacyRefresh ? 15_000 : 30_000;
    const interval = window.setInterval(() => {
      silentReload();
    }, pollMs);
    return () => window.clearInterval(interval);
  }, [isLoading, data, silentReload]);

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

  const patientJourneySteps = useMemo(() => {
    const t = data?.token;
    const tr = data?.tracking ?? {};
    if (!t) {
      return [];
    }
    return buildJourneyStepsFromTracking(tr, t).map((seg) =>
      mapJourneyStepForDisplay(seg, formatDateTime)
    );
  }, [data, nowMs]);

  if (isLoading && !data) {
    return (
      <div className="cc-detail">
        <div className="cc-patient-header">
          <div className="cc-skeleton" style={{ height: 28, width: "40%", marginBottom: 8 }} />
          <div className="cc-skeleton" style={{ height: 14, width: "60%" }} />
        </div>
        <div className="cc-kpi-row">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="cc-skeleton" style={{ height: 100 }} />
          ))}
        </div>
      </div>
    );
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
  const labWaitSeconds = getDetailTatSeconds(tracking, token.status, metrics, "lab_wait", nowMs);
  const labTestSeconds = getDetailTatSeconds(tracking, token.status, metrics, "lab_test", nowMs);
  const treatmentSeconds = getDetailTatSeconds(tracking, token.status, metrics, "treatment", nowMs);
  const overallSeconds =
    token.status === "COMPLETED"
      ? (overallVisitSeconds(tracking, token) ??
        ["waiting", "consult", "lab_wait", "lab_test", "treatment"]
          .map((k) => getDetailTatSeconds(tracking, token.status, metrics, k, nowMs))
          .filter((v) => v != null)
          .reduce((sum, v) => sum + v, 0))
      : ["waiting", "consult", "lab_wait", "lab_test", "treatment"]
          .map((k) => getDetailTatSeconds(tracking, token.status, metrics, k, nowMs))
          .filter((v) => v != null)
          .reduce((sum, v) => sum + v, 0);
  const visitCompletedAtLabel = formatDateTime(resolveVisitCompletedAt(tracking, token));
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
  const pharmacyHisTimes = resolvePharmacyTimes(tracking);
  const pharmacyLogs = Array.isArray(tracking.pharmacy_logs) ? tracking.pharmacy_logs : [];
  const pharmacyTotalSeconds =
    pharmacyHisTimes.billAt && pharmacyHisTimes.completedAt
      ? toSecondsFromRange(pharmacyHisTimes.billAt, pharmacyHisTimes.completedAt, nowMs)
      : pharmacyHisTimes.billAt
        ? toSecondsFromRange(pharmacyHisTimes.billAt, null, nowMs)
        : getWorkflowTotalSeconds(tracking.pharmacy_logs, tracking.pharmacy_start, nowMs);
  const treatmentTotalSeconds = getWorkflowTotalSeconds(
    tracking.treatment_logs,
    tracking.care_start,
    nowMs
  );
  const treatmentCurrentStartDisplay = getDisplayCurrentStart(
    tracking.care_start,
    tracking.treatment_logs
  );
  const labHisTimes = resolveLabTimes(tracking);
  const labLogs = Array.isArray(tracking.lab_logs) ? tracking.lab_logs : [];
  const labBounds = getLogBounds(tracking.lab_logs, tracking.lab_start, tracking.lab_end);
  const treatmentBounds = getLogBounds(
    tracking.treatment_logs,
    tracking.care_start,
    tracking.care_end
  );
  const postConsultPlans = Array.isArray(tracking.post_consult_plans)
    ? tracking.post_consult_plans
    : [];
  const inLabPath =
    Boolean(tracking.labs_ordered) ||
    Boolean(tracking.lab_start) ||
    Boolean(tracking.lab_end) ||
    postConsultPlans.map((p) => String(p).toLowerCase()).includes("labs");
  const labWaitDurationLabel = !tracking.consult_end || !inLabPath
    ? "--"
    : !tracking.lab_start
      ? `${formatSeconds(labWaitSeconds)} elapsed`
      : formatSeconds(labWaitSeconds);
  const labTestDurationLabel = !tracking.lab_start
    ? "--"
    : !tracking.lab_end
      ? `${formatSeconds(labTestSeconds)} elapsed`
      : formatSeconds(labTestSeconds);

  const billingPayments = Array.isArray(tracking.billing_payments) ? tracking.billing_payments : [];
  const postConsultPlansSaved = Array.isArray(tracking.post_consult_plans)
    ? tracking.post_consult_plans
    : [];
  const treatmentPaidAt = getLatestLabelPaymentAt(billingPayments, "treatment");
  const treatmentBilledSeconds =
    treatmentCurrentStartDisplay && treatmentPaidAt
      ? toSecondsFromRange(treatmentCurrentStartDisplay, treatmentPaidAt, nowMs)
      : null;
  const treatmentLabelPayments = getLabeledPaymentTimeline(billingPayments, "treatment");
  const visitPhaseRow = detailToRevertRow(token, tracking);
  const visitPhaseLabel = getVisitPhaseLabel(visitPhaseRow);
  const visitPhaseChipClass = getVisitPhaseChipClass(visitPhaseRow);

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
      await endConsultRequest(id);
      setShowEndConsultConfirm(false);
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
    <>
      <ClinicalTokenDetailLayout
        token={token}
        patient={patient}
        tracking={tracking}
        visitPhaseLabel={visitPhaseLabel}
        visitPhaseChipClass={visitPhaseChipClass}
        postConsultPlansSaved={postConsultPlansSaved}
        postConsultLabel={postConsultLabel}
        isActing={isActing}
        actionError={actionError}
        onStartConsult={() => runTokenAction("start_consult")}
        onEndConsult={() => runTokenAction("end_consult")}
        onCompleteVisit={() => runTokenAction("complete_visit")}
        onRevert={openRevertModal}
        revertAllowed={revertAllowed}
        onStartTreatment={() => runTokenAction("start_treatment")}
        onEndTreatment={() => runTokenAction("end_treatment")}
        canStartTreatment={
          !isActing &&
          token.status === "CONSULTING" &&
          Boolean(tracking.consult_end) &&
          token.status !== "COMPLETED" &&
          token.status !== "IN_TREATMENT"
        }
        canEndTreatment={!isActing && token.status === "IN_TREATMENT"}
        waitingSeconds={waitingSeconds}
        consultSeconds={consultSeconds}
        treatmentSeconds={treatmentSeconds}
        overallSeconds={overallSeconds}
        visitCompletedAtLabel={visitCompletedAtLabel}
        consultStartedAt={consultStartedAt}
        consultDurationLabel={consultDurationLabel}
        treatmentStartedAt={treatmentStartedAt}
        treatmentDurationLabel={treatmentDurationLabel}
        pharmacyLogs={pharmacyLogs}
        labLogs={labLogs}
        billingPayments={billingPayments}
        treatmentLogs={Array.isArray(tracking.treatment_logs) ? tracking.treatment_logs : []}
        treatmentLabelPayments={treatmentLabelPayments}
        patientJourneySteps={patientJourneySteps}
        formatDateTime={formatDateTime}
        formatSeconds={formatSeconds}
      />

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
              <div className="consult-modal-actions end-consult-modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowEndConsultConfirm(false)}
                  disabled={isActing}
                >
                  Cancel
                </button>
                <button type="button" onClick={confirmEndConsult} disabled={isActing}>
                  {isActing ? "Working…" : "End consult"}
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
                Are you sure you want to complete this token now? Any active workflow will be closed.
              </p>
              <div className="consult-modal-actions">
                <button type="button" onClick={confirmCompleteVisit} disabled={isActing}>
                  {isActing ? "Working…" : "Yes, complete now"}
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
    </>
  );
};
