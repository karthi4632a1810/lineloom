import { useCallback, useEffect, useState } from "react";
import {
  fetchIntelligenceSummary,
  refreshModelVersionRequest
} from "../services/intelligenceService";
import { fetchAlertRecommendations } from "../services/alertService";

export const IntelligencePage = () => {
  const [summary, setSummary] = useState(null);
  const [recs, setRecs] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const role = localStorage.getItem("auth_role") ?? "nurse";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [intel, recommendations] = await Promise.all([
        fetchIntelligenceSummary(),
        fetchAlertRecommendations().catch(() => null)
      ]);
      setSummary(intel);
      setRecs(recommendations);
    } catch (err) {
      setError(err?.message ?? "Failed to load intelligence");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleModelRefresh = async () => {
    setRefreshing(true);
    setError("");
    try {
      await refreshModelVersionRequest();
      await load();
    } catch (err) {
      setError(err?.message ?? "Model refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const stats = summary?.stats;
  const forecast = summary?.forecast;

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>AI insights &amp; analytics</h1>
          <p className="page-subtitle">
            Forecasts and anomaly flags from MongoDB history. No external LLM unless you configure one
            server-side.
          </p>
        </div>
        <div className="filter-row">
          <button type="button" onClick={load} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
          {role === "admin" ? (
            <button type="button" onClick={handleModelRefresh} disabled={refreshing || loading}>
              {refreshing ? "Refreshing model…" : "Refresh model version"}
            </button>
          ) : null}
        </div>
      </header>

      {error ? <p className="error-text">{error}</p> : null}
      {loading && !summary ? <p>Loading…</p> : null}

      {summary ? (
        <>
          <div className="funnel-grid" style={{ marginBottom: 18 }}>
            <article className="card funnel-card">
              <p>7d mean daily avg wait</p>
              <h2>{stats?.mean_7d_daily_avg_wait ?? "—"}</h2>
              <small className="muted-inline">minutes (from visit cohort)</small>
            </article>
            <article className="card funnel-card">
              <p>Volatility (σ)</p>
              <h2>{stats?.std_7d_daily_avg_wait ?? "—"}</h2>
            </article>
            <article className="card funnel-card">
              <p>Today avg wait</p>
              <h2>{stats?.today_avg_wait ?? "—"}</h2>
            </article>
            <article className="card funnel-card">
              <p>Naive forecast (next day)</p>
              <h2>{forecast?.expected_avg_wait_minutes_next_day ?? "—"}</h2>
              <small className="muted-inline">{forecast?.method ?? ""}</small>
            </article>
          </div>

          <article className="card" style={{ marginBottom: 18 }}>
            <h3>Anomaly</h3>
            {stats?.anomaly ? (
              <p className="error-text">{stats.anomaly_reason || "Elevated vs recent baseline."}</p>
            ) : (
              <p>No statistical anomaly flagged for today (mean + 2σ rule).</p>
            )}
          </article>

          <article className="card" style={{ marginBottom: 18 }}>
            <h3>Narrative</h3>
            <p>{summary.narrative}</p>
          </article>
        </>
      ) : null}

      {recs?.recommendations?.length ? (
        <article className="card">
          <h3>Operational recommendations</h3>
          <p className="page-subtitle">Same rule-based hints as the Alerts page.</p>
          <ul className="recs-list">
            {recs.recommendations.map((line, i) => (
              <li key={`rec-${i}`}>
                <strong>{line.title}</strong>
                <p>{line.recommendation}</p>
              </li>
            ))}
          </ul>
        </article>
      ) : null}
    </section>
  );
};
