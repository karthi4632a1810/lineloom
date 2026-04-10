import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAsyncData } from "../hooks/useAsyncData";
import {
  endCareRequest,
  fetchTokenDetail,
  startCareRequest,
  startConsultRequest
} from "../services/tokenService";

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

const getStatusLabel = (status = "WAITING") => {
  const map = {
    WAITING: "In Waiting",
    CONSULTING: "In Consulting",
    IN_TREATMENT: "In Treatment",
    COMPLETED: "Completed"
  };
  return map[status] ?? "In Waiting";
};

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
  const [actionError, setActionError] = useState("");
  const [isActing, setIsActing] = useState(false);

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
  const waitingMinutes = metrics.waiting_time_minutes ?? 0;
  const consultMinutes = metrics.consult_time_minutes ?? 0;
  const careMinutes = metrics.care_time_minutes ?? 0;
  const overallMinutes = Number((waitingMinutes + consultMinutes + careMinutes).toFixed(2));
  const consultStartedAt = formatDateTime(tracking.consult_start);
  const consultDurationLabel =
    tracking.consult_start && !tracking.consult_end
      ? `${consultMinutes} min elapsed`
      : `${consultMinutes} min`;

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
      active: token.status === "CONSULTING"
    },
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

  const runTokenAction = async (action = "start_consult") => {
    const id = String(token?.token_id ?? resolvedTokenId ?? "");
    if (!id) {
      return;
    }
    setActionError("");
    setIsActing(true);
    try {
      if (action === "start_consult") {
        await startConsultRequest(id, { department: token?.department ?? "" });
      } else if (action === "start_treatment") {
        await startCareRequest(id);
      } else if (action === "end_treatment") {
        await endCareRequest(id);
      }
      await reload();
    } catch (requestError) {
      setActionError(requestError?.message ?? "Unable to update token state");
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
              <span>{getStatusLabel(token.status)}</span>
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
            onClick={() => runTokenAction("start_treatment")}
            disabled={isActing || token.status === "COMPLETED"}
          >
            Start Treatment
          </button>
          <button
            type="button"
            onClick={() => runTokenAction("end_treatment")}
            disabled={isActing || token.status !== "IN_TREATMENT"}
          >
            End Treatment
          </button>
        </div>
      </header>
      {actionError ? <p className="error-text">{actionError}</p> : null}

      <div className="detail-grid">
        <div className="detail-main">
          <section className="detail-stats">
            <article className="card">
              <p>Total Wait Time</p>
              <h3>{waitingMinutes} min</h3>
            </article>
            <article className="card">
              <p>Consulting Since</p>
              <h3>{consultStartedAt}</h3>
              <small>{consultDurationLabel}</small>
            </article>
            <article className="card">
              <p>Estimated TAT</p>
              <h3>{overallMinutes} min</h3>
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
            <div className="journey-list">
              {timeline.map((step) => (
                <div key={step.label} className={`journey-step ${step.active ? "active" : ""}`}>
                  <span className={`dot ${step.done ? "done" : ""}`}>{step.done ? "✓" : ""}</span>
                  <div>
                    <strong>{step.label}</strong>
                    <p>{step.time}</p>
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
