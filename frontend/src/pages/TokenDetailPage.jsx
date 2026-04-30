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
  endLabRequest,
  fetchTokenDetail,
  endBillingRequest,
  endPharmacyRequest,
  recordBillingPaymentRequest,
  startBillingRequest,
  startPharmacyRequest,
  stopBillingRequest,
  stopPharmacyRequest,
  startCareRequest,
  startConsultRequest,
  startLabRequest,
  revertTokenRequest
} from "../services/tokenService";
import { fetchTokenJourney } from "../services/journeyService";
import { resolveEffectiveTreatmentStart } from "../utils/tatSegments";
import { postConsultLabel } from "../constants/postConsultOptions";
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

const mapPaymentsToSessions = (logs = [], payments = [], label = "") => {
  const entries = Array.isArray(logs) ? logs : [];
  const filteredPayments = getLabeledPaymentTimeline(payments, label);
  const mapped = entries.map(() => []);
  if (!entries.length || !filteredPayments.length) {
    return mapped;
  }
  filteredPayments.forEach((payment) => {
    const paidMs = payment?.paid_at ? new Date(payment.paid_at).getTime() : NaN;
    if (Number.isNaN(paidMs)) {
      return;
    }
    let targetIndex = -1;
    entries.forEach((entry, idx) => {
      const startMs = entry?.start ? new Date(entry.start).getTime() : NaN;
      if (!Number.isNaN(startMs) && startMs <= paidMs) {
        targetIndex = idx;
      }
    });
    if (targetIndex >= 0) {
      mapped[targetIndex].push(payment);
    }
  });
  return mapped;
};

const getSessionStartForPayment = (logs = [], paidAt = null) => {
  if (!paidAt) {
    return null;
  }
  const paidMs = new Date(paidAt).getTime();
  if (Number.isNaN(paidMs)) {
    return null;
  }
  const entries = (Array.isArray(logs) ? logs : [])
    .map((entry) => ({
      start: entry?.start ? new Date(entry.start) : null
    }))
    .filter((entry) => entry.start && !Number.isNaN(entry.start.getTime()))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  if (!entries.length) {
    return null;
  }
  let selected = entries[0].start;
  for (const entry of entries) {
    if (entry.start.getTime() <= paidMs) {
      selected = entry.start;
    } else {
      break;
    }
  }
  return selected;
};

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
    return (
      toSecondsFromRange(
        tracking.consult_end,
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
  const [hisDepartments, setHisDepartments] = useState([]);
  const [consultDept, setConsultDept] = useState("");
  const [billingAmountInput, setBillingAmountInput] = useState("");
  const [billingNoteInput, setBillingNoteInput] = useState("");
  const [billingLabelInput, setBillingLabelInput] = useState("");
  const [showPharmacyBillingModal, setShowPharmacyBillingModal] = useState(false);
  const [pharmacyBillingAmountInput, setPharmacyBillingAmountInput] = useState("");
  const [pharmacyBillingNoteInput, setPharmacyBillingNoteInput] = useState("");
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
  const overallSeconds = ["waiting", "consult", "lab_wait", "lab_test", "treatment"]
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
  const pharmacyTotalSeconds = getWorkflowTotalSeconds(
    tracking.pharmacy_logs,
    tracking.pharmacy_start,
    nowMs
  );
  const labTotalSeconds = getWorkflowTotalSeconds(tracking.lab_logs, tracking.lab_start, nowMs);
  const treatmentTotalSeconds = getWorkflowTotalSeconds(
    tracking.treatment_logs,
    tracking.care_start,
    nowMs
  );
  const pharmacyCurrentStartDisplay = getDisplayCurrentStart(
    tracking.pharmacy_start,
    tracking.pharmacy_logs
  );
  const labCurrentStartDisplay = getDisplayCurrentStart(tracking.lab_start, tracking.lab_logs);
  const treatmentCurrentStartDisplay = getDisplayCurrentStart(
    tracking.care_start,
    tracking.treatment_logs
  );
  const labBounds = getLogBounds(tracking.lab_logs, tracking.lab_start, tracking.lab_end);
  const treatmentBounds = getLogBounds(
    tracking.treatment_logs,
    tracking.care_start,
    tracking.care_end
  );
  const billingDurationLabel =
    billingSeconds == null
      ? "--"
      : tracking.billing_start && !tracking.billing_end
        ? `${formatSeconds(billingSeconds)} elapsed`
        : formatSeconds(billingSeconds);
  const inLabPath =
    Boolean(tracking.labs_ordered) || Boolean(tracking.lab_start) || Boolean(tracking.lab_end);
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
  const billingPaidAmount =
    Number(tracking.billing_paid_amount ?? 0) ||
    billingPayments.reduce((sum, item) => sum + (Number(item?.amount ?? 0) || 0), 0);
  const hasBillingStats =
    billingSeconds != null ||
    Boolean(tracking.billing_start) ||
    Boolean(tracking.billing_end) ||
    (Number(tracking.billing_elapsed_ms ?? 0) || 0) > 0 ||
    billingPayments.length > 0;
  const billingClockLabel = tracking.billing_start
    ? formatDateTime(tracking.billing_start)
    : tracking.billing_end
      ? formatDateTime(tracking.billing_end)
      : "--";
  const postConsultPlansSaved = Array.isArray(tracking.post_consult_plans)
    ? tracking.post_consult_plans
    : [];
  const labPaidAt = getLatestLabelPaymentAt(billingPayments, "lab");
  const treatmentPaidAt = getLatestLabelPaymentAt(billingPayments, "treatment");
  const labBilledSeconds =
    labCurrentStartDisplay && labPaidAt
      ? toSecondsFromRange(labCurrentStartDisplay, labPaidAt, nowMs)
      : null;
  const treatmentBilledSeconds =
    treatmentCurrentStartDisplay && treatmentPaidAt
      ? toSecondsFromRange(treatmentCurrentStartDisplay, treatmentPaidAt, nowMs)
      : null;
  const pharmacyLabelPayments = getLabeledPaymentTimeline(billingPayments, "pharmacy");
  const labLabelPayments = getLabeledPaymentTimeline(billingPayments, "lab");
  const treatmentLabelPayments = getLabeledPaymentTimeline(billingPayments, "treatment");
  const pharmacyPaymentsBySession = mapPaymentsToSessions(
    tracking.pharmacy_logs,
    billingPayments,
    "pharmacy"
  );
  const labPaymentsBySession = mapPaymentsToSessions(tracking.lab_logs, billingPayments, "lab");
  const treatmentPaymentsBySession = mapPaymentsToSessions(
    tracking.treatment_logs,
    billingPayments,
    "treatment"
  );
  const overallWorkflowStart = [
    getDisplayCurrentStart(tracking.pharmacy_start, tracking.pharmacy_logs),
    getDisplayCurrentStart(tracking.lab_start, tracking.lab_logs),
    getDisplayCurrentStart(tracking.care_start, tracking.treatment_logs)
  ]
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

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
    ...(tracking.consult_end && inLabPath
      ? [
          {
            label: "Lab waiting",
            time: formatDateTime(tracking.consult_end),
            done: Boolean(tracking.lab_start),
            active: token.status === "CONSULTING" && !tracking.lab_start
          },
          {
            label: "Lab testing",
            time: tracking.lab_start ? formatDateTime(tracking.lab_start) : "--",
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
          kind: String(seg.kind ?? "").toLowerCase(),
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
      setShowEndConsultConfirm(true);
      return;
    }
    if (action === "complete_visit") {
      setShowCompleteVisitConfirm(true);
      return;
    }
    setActionError("");
    setIsActing(true);
    let openPharmacyBillingPrompt = false;
    try {
      if (action === "start_treatment") {
        await startCareRequest(id);
      } else if (action === "end_treatment") {
        await endCareRequest(id);
      } else if (action === "start_billing") {
        await startBillingRequest(id);
      } else if (action === "stop_billing") {
        await stopBillingRequest(id);
      } else if (action === "end_billing") {
        await endBillingRequest(id);
      } else if (action === "start_pharmacy") {
        await startPharmacyRequest(id);
      } else if (action === "stop_pharmacy") {
        await stopPharmacyRequest(id);
      } else if (action === "end_pharmacy") {
        await endPharmacyRequest(id);
        openPharmacyBillingPrompt = true;
      } else if (action === "record_payment") {
        const amount = Number(billingAmountInput);
        await recordBillingPaymentRequest(id, {
          amount: Number.isFinite(amount) ? amount : billingAmountInput,
          note: billingNoteInput,
          billing_label: billingLabelInput || undefined
        });
        setBillingAmountInput("");
        setBillingNoteInput("");
        setBillingLabelInput("");
      } else if (action === "start_lab") {
        await startLabRequest(id);
      } else if (action === "end_lab") {
        await endLabRequest(id);
      }
      await refreshTokenViews();
      window.dispatchEvent(new CustomEvent("lineloom-token-refresh", { detail: { tokenId: id } }));
      if (openPharmacyBillingPrompt) {
        setPharmacyBillingAmountInput("");
        setPharmacyBillingNoteInput("");
        setShowPharmacyBillingModal(true);
      }
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

  const submitPharmacyBillingPayment = async () => {
    const id = String(token?.token_id ?? resolvedTokenId ?? "");
    if (!id) {
      return;
    }
    const amount = Number(pharmacyBillingAmountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      setActionError("Enter a valid pharmacy billing amount.");
      return;
    }
    setActionError("");
    setIsActing(true);
    try {
      if (!tracking.billing_start || tracking.billing_end) {
        await startBillingRequest(id);
      }
      await recordBillingPaymentRequest(id, {
        amount,
        note: pharmacyBillingNoteInput,
        billing_label: "pharmacy"
      });
      setShowPharmacyBillingModal(false);
      setPharmacyBillingAmountInput("");
      setPharmacyBillingNoteInput("");
      await refreshTokenViews();
      window.dispatchEvent(new CustomEvent("lineloom-token-refresh", { detail: { tokenId: id } }));
    } catch (requestError) {
      setActionError(requestError?.message ?? "Unable to add pharmacy billing payment");
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
            {postConsultPlansSaved.length ? (
              <div className="post-consult-chips" aria-label="Selected after consult">
                {postConsultPlansSaved.map((id) => (
                  <span key={id} className="post-consult-chip">
                    {postConsultLabel(id)}
                  </span>
                ))}
              </div>
            ) : null}
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
          <button
            type="button"
            className="btn-complete-visit"
            onClick={() => runTokenAction("complete_visit")}
            disabled={isActing || token.status === "COMPLETED"}
            title="Complete this token now"
          >
            Complete visit
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

      {showPharmacyBillingModal ? (
        <section className="modal-overlay">
          <article className="modal-card consult-modal">
            <div className="consult-modal-header">
              <h3>Pharmacy billing amount</h3>
            </div>
            <div className="consult-modal-form">
              <p className="confirm-text">
                Pharmacy ended. Add billing amount now?
              </p>
              <label htmlFor="pharmacy_billing_amount">Amount</label>
              <input
                id="pharmacy_billing_amount"
                type="number"
                min="0.01"
                step="0.01"
                value={pharmacyBillingAmountInput}
                onChange={(event) => setPharmacyBillingAmountInput(event.target.value)}
                placeholder="e.g. 150"
              />
              <label htmlFor="pharmacy_billing_note">Note (optional)</label>
              <input
                id="pharmacy_billing_note"
                type="text"
                value={pharmacyBillingNoteInput}
                onChange={(event) => setPharmacyBillingNoteInput(event.target.value)}
                placeholder="Medicine bill / payment note"
              />
              <div className="consult-modal-actions">
                <button type="button" onClick={submitPharmacyBillingPayment} disabled={isActing}>
                  {isActing ? "Saving…" : "Save payment"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowPharmacyBillingModal(false)}
                  disabled={isActing}
                >
                  Skip for now
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
            {hasBillingStats ? (
              <article className="card">
                <p>Billing time</p>
                <div className="detail-stat-datetime">{billingClockLabel}</div>
                <small>{billingDurationLabel}</small>
              </article>
            ) : null}
            {tracking.consult_end && inLabPath ? (
              <>
                <article className="card">
                  <p>Lab waiting</p>
                  <div className="detail-stat-datetime">{formatDateTime(tracking.consult_end)}</div>
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
            <h3>Post-Consult Workflow Slots</h3>
            <div className="workflow-slot-grid">
              <div className="workflow-slot-card">
                <div className="workflow-slot-head">
                  <p className="workflow-slot-title">Pharmacy</p>
                  <span className="workflow-slot-chip">
                    Elapsed: {formatSeconds(pharmacyTotalSeconds)}
                  </span>
                </div>
                <p className="workflow-slot-time">
                  Start: {formatDateTime(pharmacyCurrentStartDisplay)}
                </p>
                <p className="workflow-slot-time">
                  End: {formatDateTime(tracking.pharmacy_end)}
                </p>
                <div className="workflow-slot-actions">
                  <button
                    type="button"
                    onClick={() => runTokenAction("start_pharmacy")}
                    disabled={
                      isActing ||
                      token.status !== "CONSULTING" ||
                      !tracking.consult_end ||
                      Boolean(tracking.pharmacy_start)
                    }
                  >
                    Start
                  </button>
                  <button
                    type="button"
                    onClick={() => runTokenAction("end_pharmacy")}
                    disabled={
                      isActing ||
                      token.status !== "CONSULTING" ||
                      !tracking.consult_end ||
                      !tracking.pharmacy_start
                    }
                  >
                    End
                  </button>
                </div>
              </div>
              <div className="workflow-slot-card">
                <div className="workflow-slot-head">
                  <p className="workflow-slot-title">Lab</p>
                  <span className="workflow-slot-chip">
                    Elapsed: {formatSeconds(labTotalSeconds)}
                  </span>
                </div>
                <p className="workflow-slot-time">Start: {formatDateTime(tracking.lab_start)}</p>
                <p className="workflow-slot-time">End: {formatDateTime(tracking.lab_end)}</p>
                <div className="workflow-slot-actions">
                  <button
                    type="button"
                    onClick={() => runTokenAction("start_lab")}
                    disabled={
                      isActing ||
                      token.status !== "CONSULTING" ||
                      !tracking.consult_end ||
                      Boolean(tracking.lab_start) && !tracking.lab_end
                    }
                  >
                    Start
                  </button>
                  <button
                    type="button"
                    onClick={() => runTokenAction("end_lab")}
                    disabled={isActing || !tracking.lab_start || Boolean(tracking.lab_end)}
                  >
                    End
                  </button>
                </div>
              </div>
              <div className="workflow-slot-card">
                <div className="workflow-slot-head">
                  <p className="workflow-slot-title">Treatment</p>
                  <span className="workflow-slot-chip">
                    Elapsed: {formatSeconds(treatmentTotalSeconds)}
                  </span>
                </div>
                <p className="workflow-slot-time">Start: {formatDateTime(tracking.care_start)}</p>
                <p className="workflow-slot-time">End: {formatDateTime(tracking.care_end)}</p>
                <div className="workflow-slot-actions">
                  <button
                    type="button"
                    onClick={() => runTokenAction("start_treatment")}
                    disabled={
                      isActing ||
                      token.status === "COMPLETED" ||
                      token.status === "IN_TREATMENT"
                    }
                  >
                    Start
                  </button>
                  <button
                    type="button"
                    onClick={() => runTokenAction("end_treatment")}
                    disabled={isActing || token.status !== "IN_TREATMENT"}
                  >
                    End
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <h3>Workflow Time Log</h3>
            <div className="workflow-log-sections">
              <div className="table-card">
                <h4>Pharmacy Logs</h4>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Start time</th>
                      <th>End time</th>
                      <th>Payment time</th>
                      <th>Payments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(tracking.pharmacy_logs) ? tracking.pharmacy_logs : []).length ? (
                      [...(tracking.pharmacy_logs ?? [])].reverse().map((entry, idx) => {
                        const chronoIndex = (tracking.pharmacy_logs ?? []).length - 1 - idx;
                        const billed = pharmacyLabelPayments[chronoIndex]?.paid_at ?? null;
                        const elapsedEnd = billed ?? tracking.billing_end ?? null;
                        const billedSeconds = elapsedEnd
                          ? toSecondsFromRange(entry?.start, elapsedEnd, nowMs)
                          : null;
                        return (
                          <tr key={`pharmacy-time-log-${idx}`}>
                            <td>{idx + 1}</td>
                            <td>{formatDateTime(entry?.start)}</td>
                            <td>{formatDateTime(entry?.end)}</td>
                            <td>{formatDateTime(elapsedEnd)}</td>
                            <td>
                              {pharmacyPaymentsBySession[chronoIndex]?.length ? (
                                <div className="session-payments-list">
                                  {pharmacyPaymentsBySession[chronoIndex].map((p, pIdx) => (
                                    <span key={`ph-pay-${idx}-${pIdx}`}>
                                      {Number(p?.amount ?? 0)} @ {formatDateTime(p?.paid_at)}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                "--"
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5}>No pharmacy logs yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="table-card">
                <h4>Lab Logs</h4>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Start time</th>
                      <th>End time</th>
                      <th>Payment time</th>
                      <th>Payments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(tracking.lab_logs) ? tracking.lab_logs : []).length ? (
                      [...(tracking.lab_logs ?? [])].reverse().map((entry, idx) => {
                        const chronoIndex = (tracking.lab_logs ?? []).length - 1 - idx;
                        const billed = labLabelPayments[chronoIndex]?.paid_at ?? null;
                        const elapsedEnd = billed ?? tracking.billing_end ?? null;
                        const billedSeconds = elapsedEnd
                          ? toSecondsFromRange(entry?.start, elapsedEnd, nowMs)
                          : null;
                        return (
                          <tr key={`lab-time-log-${idx}`}>
                            <td>{idx + 1}</td>
                            <td>{formatDateTime(entry?.start)}</td>
                            <td>{formatDateTime(entry?.end)}</td>
                            <td>{formatDateTime(elapsedEnd)}</td>
                            <td>
                              {labPaymentsBySession[chronoIndex]?.length ? (
                                <div className="session-payments-list">
                                  {labPaymentsBySession[chronoIndex].map((p, pIdx) => (
                                    <span key={`lab-pay-${idx}-${pIdx}`}>
                                      {Number(p?.amount ?? 0)} @ {formatDateTime(p?.paid_at)}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                "--"
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5}>No lab logs yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="table-card">
                <h4>Treatment Logs</h4>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Start time</th>
                      <th>End time</th>
                      <th>Payment time</th>
                      <th>Payments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(tracking.treatment_logs) ? tracking.treatment_logs : []).length ? (
                      [...(tracking.treatment_logs ?? [])].reverse().map((entry, idx) => {
                        const chronoIndex = (tracking.treatment_logs ?? []).length - 1 - idx;
                        const billed = treatmentLabelPayments[chronoIndex]?.paid_at ?? null;
                        const elapsedEnd = billed ?? tracking.billing_end ?? null;
                        const billedSeconds = elapsedEnd
                          ? toSecondsFromRange(entry?.start, elapsedEnd, nowMs)
                          : null;
                        return (
                          <tr key={`treatment-time-log-${idx}`}>
                            <td>{idx + 1}</td>
                            <td>{formatDateTime(entry?.start)}</td>
                            <td>{formatDateTime(entry?.end)}</td>
                            <td>{formatDateTime(elapsedEnd)}</td>
                            <td>
                              {treatmentPaymentsBySession[chronoIndex]?.length ? (
                                <div className="session-payments-list">
                                  {treatmentPaymentsBySession[chronoIndex].map((p, pIdx) => (
                                    <span key={`tr-pay-${idx}-${pIdx}`}>
                                      {Number(p?.amount ?? 0)} @ {formatDateTime(p?.paid_at)}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                "--"
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5}>No treatment logs yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>

        <aside className="detail-side">
          <section className="card">
            <h3>Billing Desk</h3>
            <div className="vitals-grid" style={{ marginBottom: 12 }}>
              <div className="vital-card">
                <p>Paid</p>
                <h4>{Number(billingPaidAmount.toFixed(2))}</h4>
              </div>
              <div className="vital-card">
                <p>Status</p>
                <h4>
                  {tracking.billing_end
                    ? "Ended"
                    : tracking.billing_start
                      ? "Active"
                      : "Stopped"}
                </h4>
              </div>
            </div>
            <div className="journey-list">
              <div className="journey-step">
                <span className={`dot ${tracking.billing_start ? "done" : ""}`}>
                  {tracking.billing_start ? "✓" : ""}
                </span>
                <div className="journey-step-body">
                  <strong>Billing started</strong>
                  <p className="journey-step-time">{formatDateTime(tracking.billing_start)}</p>
                </div>
              </div>
              <div className="journey-step">
                <span className={`dot ${tracking.billing_end ? "done" : ""}`}>
                  {tracking.billing_end ? "✓" : ""}
                </span>
                <div className="journey-step-body">
                  <strong>Payment recorded</strong>
                  <p className="journey-step-time">{formatDateTime(tracking.billing_end)}</p>
                </div>
              </div>
            </div>
            <div className="consult-modal-form" style={{ marginBottom: 8 }}>
              <label htmlFor="billing_amount_input">Payment amount</label>
              <div className="billing-amount-row">
                <input
                  id="billing_amount_input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={billingAmountInput}
                  onChange={(event) => setBillingAmountInput(event.target.value)}
                  placeholder="e.g. 100"
                />
                <button
                  type="button"
                  className="billing-add-inline"
                  onClick={() => runTokenAction("record_payment")}
                  disabled={
                    isActing ||
                    !String(billingAmountInput ?? "").trim()
                  }
                  title="Add payment"
                >
                  +
                </button>
              </div>
              <label htmlFor="billing_note_input">Payment note (optional)</label>
              <input
                id="billing_note_input"
                type="text"
                value={billingNoteInput}
                onChange={(event) => setBillingNoteInput(event.target.value)}
                placeholder="Cash / UPI ref / split payment"
              />
              <label htmlFor="billing_label_input">Billing label</label>
              <select
                id="billing_label_input"
                value={billingLabelInput}
                onChange={(event) => setBillingLabelInput(event.target.value)}
              >
                <option value="">General / untagged</option>
                <option value="lab">Lab</option>
                <option value="pharmacy">Pharmacy</option>
                <option value="treatment">Treatment</option>
              </select>
            </div>
            <div className="urgent-list">
            </div>
            {billingPayments.length ? (
              <div className="table-card" style={{ marginTop: 12 }}>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Amount</th>
                      <th>Label</th>
                      <th>Paid at</th>
                      <th>Billing elapsed time</th>
                      <th>Overall elapsed time</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingPayments.map((payment, idx) => (
                      (() => {
                        const label = String(payment?.label ?? "").trim().toLowerCase();
                        const sessionStart =
                          label === "pharmacy"
                            ? getSessionStartForPayment(tracking.pharmacy_logs, payment?.paid_at)
                            : label === "lab"
                              ? getSessionStartForPayment(tracking.lab_logs, payment?.paid_at)
                              : label === "treatment"
                                ? getSessionStartForPayment(tracking.treatment_logs, payment?.paid_at)
                                : null;
                        const billingElapsed =
                          sessionStart && payment?.paid_at
                            ? formatSeconds(toSecondsFromRange(sessionStart, payment?.paid_at, nowMs))
                            : "--";
                        const overallElapsed =
                          overallWorkflowStart && payment?.paid_at
                            ? formatSeconds(
                                toSecondsFromRange(overallWorkflowStart, payment?.paid_at, nowMs)
                              )
                            : "--";
                        return (
                          <tr key={`pay-${idx}-${payment?.paid_at ?? ""}`}>
                            <td>{idx + 1}</td>
                            <td>{Number(payment?.amount ?? 0)}</td>
                            <td>{label || "--"}</td>
                            <td>{formatDateTime(payment?.paid_at)}</td>
                            <td>{billingElapsed}</td>
                            <td>{overallElapsed}</td>
                            <td>{String(payment?.note ?? "").trim() || "--"}</td>
                          </tr>
                        );
                      })()
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
          <section className="card">
            <h3>Patient Journey</h3>
            {journeyLoading ? <p className="muted-inline">Updating timeline…</p> : null}
            {journeyError ? <p className="error-text">{journeyError}</p> : null}
            <div className="journey-list journey-graph">
              {(journeyFromApi ?? timeline).map((step, index, allSteps) => (
                (() => {
                  const labelLower = String(step?.label ?? "").toLowerCase();
                  const resolvedKind = String(step?.kind ?? "").toLowerCase();
                  const kindKey =
                    resolvedKind ||
                    (labelLower.includes("billing")
                      ? "billing"
                      : labelLower.includes("pharmacy")
                        ? "pharmacy"
                        : labelLower.includes("lab")
                          ? "lab"
                          : labelLower.includes("treatment")
                            ? "treatment"
                            : "core");
                  const isBillingStep = kindKey === "billing";
                  const billingItems = isBillingStep
                    ? [...billingPayments]
                        .map((p, idx) => ({
                          id: `bill-${idx}-${p?.paid_at ?? ""}`,
                          idx: idx + 1,
                          amount: Number(p?.amount ?? 0),
                          label: String(p?.label ?? "").trim() || "general",
                          paidAt: p?.paid_at
                        }))
                        .sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime())
                    : [];
                  const billingPrimary =
                    isBillingStep && !billingItems.length && tracking.billing_start && !tracking.billing_end
                      ? "Awaiting payment"
                      : step.timePrimary ?? step.time;
                  return (
                <div
                  key={`${step.label}-${index}`}
                  className={`journey-step ${step.active ? "active" : ""} ${
                    `journey-kind-${kindKey}`
                  } ${
                    index === allSteps.length - 1 ? "journey-step-last" : ""
                  }`}
                >
                  <span className={`dot ${step.done ? "done" : ""}`}>{step.done ? "✓" : ""}</span>
                  <div className="journey-step-body">
                    <strong>{step.label}</strong>
                    <p className="journey-step-time">{billingPrimary}</p>
                    {step.timeSecondary ? (
                      <p className="journey-step-sub">{step.timeSecondary}</p>
                    ) : null}
                    {isBillingStep && billingItems.length ? (
                      <div className="journey-children">
                        {billingItems.map((item) => (
                          <p key={item.id} className="journey-child-row">
                            Payment {item.idx} - {item.label} - {item.amount} @ {formatDateTime(item.paidAt)}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                  );
                })()
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
