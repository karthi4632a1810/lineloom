import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClinicalPageHeader } from "../components/clinical/PagePrimitives.jsx";
import { QueuePatientCard } from "../components/queue/QueuePatientCard.jsx";
import { fetchCompletedQueue } from "../services/tokenService";
import { goToTokenDetail } from "../utils/tokenPaths.js";

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

const toSecondsFromMinutes = (value = null) => {
  if (value == null) {
    return null;
  }
  return Math.max(0, Math.round(Number(value) * 60));
};

const getCompletedTatSeconds = (row = {}, key = "") => {
  if (key === "waiting") {
    return toSecondsFromMinutes(row.waiting_tat_minutes);
  }
  if (key === "consult") {
    return toSecondsFromMinutes(row.consulting_tat_minutes);
  }
  if (key === "treatment") {
    return toSecondsFromMinutes(row.treatment_tat_minutes);
  }
  return null;
};

export const CompletedQueuePage = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await fetchCompletedQueue({ search: appliedSearch });
      setRows(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError?.message ?? "Failed to load completed tokens");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [appliedSearch]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const handleApplySearch = (event) => {
    event.preventDefault();
    setAppliedSearch(searchInput.trim());
  };

  const visibleRows = useMemo(() => rows, [rows]);

  return (
    <section className="page cc-page queue-layout-page live-queue-page nf-cq-modern">
      <ClinicalPageHeader
        title="Completed visits"
        subtitle="Finished tokens with turnaround times and journey summary."
      />

      <div className="nf-stat-grid nf-cq-modern-stats" aria-label="Completed visits summary">
        <article className="summary-card nf-stat-card nf-stat-card--done">
          <h4>Completed</h4>
          <p className="nf-stat-value">{visibleRows.length}</p>
          <span className="nf-stat-caption">visits</span>
        </article>
        <article className="summary-card nf-stat-card nf-stat-card--avg-overall">
          <h4>Avg overall TAT</h4>
          <p className="nf-stat-value">
            {visibleRows.length
              ? `${Math.round(
                  visibleRows.reduce((sum, row) => sum + (Number(row.overall_tat_minutes) || 0), 0) /
                    visibleRows.length
                )}m`
              : "—"}
          </p>
          <span className="nf-stat-caption">minutes</span>
        </article>
        <article className="summary-card nf-stat-card nf-stat-card--avg-wait">
          <h4>Avg wait</h4>
          <p className="nf-stat-value">
            {visibleRows.filter((row) => row.waiting_tat_minutes != null).length
              ? `${Math.round(
                  visibleRows.reduce((sum, row) => sum + (Number(row.waiting_tat_minutes) || 0), 0) /
                    visibleRows.filter((row) => row.waiting_tat_minutes != null).length
                )}m`
              : "—"}
          </p>
          <span className="nf-stat-caption">minutes</span>
        </article>
        <article className="summary-card nf-stat-card nf-stat-card--avg-consult">
          <h4>Avg consult</h4>
          <p className="nf-stat-value">
            {visibleRows.filter((row) => row.consulting_tat_minutes != null).length
              ? `${Math.round(
                  visibleRows.reduce((sum, row) => sum + (Number(row.consulting_tat_minutes) || 0), 0) /
                    visibleRows.filter((row) => row.consulting_tat_minutes != null).length
                )}m`
              : "—"}
          </p>
          <span className="nf-stat-caption">minutes</span>
        </article>
      </div>

      <form className="nf-lq-toolbar nf-cq-modern-toolbar" onSubmit={handleApplySearch}>
        <div className="nf-panel-head">
          <h2 className="nf-panel-title">Search</h2>
          <p className="nf-panel-sub">Name, phone, reg no, visit no, or token id.</p>
        </div>
        <div className="nf-lq-toolbar-fields nf-lq-toolbar-fields--single">
          <div className="nf-lq-field">
            <label htmlFor="completed_search">Search</label>
            <input
              id="completed_search"
              type="search"
              name="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Name, phone, reg no, OP/IP visit no, token id…"
              className="nf-lq-input"
            />
          </div>
        </div>
        <div className="nf-lq-toolbar-actions">
          <button type="submit" className="nf-lq-btn nf-lq-btn--primary">
            Search
          </button>
        </div>
      </form>

      {error ? <p className="error-text">{error}</p> : null}
      {isLoading ? <p className="muted-inline">Loading completed tokens…</p> : null}
      {!isLoading && !error && !visibleRows.length ? (
        <p className="muted-inline">No completed tokens found.</p>
      ) : null}

      {!isLoading && visibleRows.length ? (
        <div className="nf-cq-modern-queue-panel">
          <div className="nf-lq-list-head">
            <div>
              <h2>Completed visits</h2>
              <p>Click a card to open the full visit record.</p>
            </div>
            <p>
              <strong>{visibleRows.length}</strong> token{visibleRows.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="nf-lq-list">
            {visibleRows.map((row) => {
              const completedAt = formatDateTime(row.visit_completed_at ?? row.treatment_end);
              return (
                <QueuePatientCard
                  key={row.token_id}
                  row={{ ...row, status: row.status || "COMPLETED" }}
                  showActions={false}
                  formatSeconds={formatSeconds}
                  getTatSeconds={getCompletedTatSeconds}
                  overallSeconds={toSecondsFromMinutes(row.overall_tat_minutes)}
                  footerNote={`Completed ${completedAt}`}
                  onOpenDetail={(r) => goToTokenDetail(navigate, r.token_id)}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
};
