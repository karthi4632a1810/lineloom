import { useCallback, useEffect, useState } from "react";
import { acknowledgeAlertRequest, fetchAlerts, fetchAlertRecommendations } from "../services/alertService";
import { recordOperationalActionRequest } from "../services/intelligenceService";

export const AlertsPage = () => {
  const [rows, setRows] = useState([]);
  const [recs, setRecs] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [actionDept, setActionDept] = useState("");
  const [actionSaving, setActionSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [list, r] = await Promise.all([
        fetchAlerts({ limit: 80, unacknowledged_only: 0 }),
        fetchAlertRecommendations()
      ]);
      setRows(Array.isArray(list) ? list : []);
      setRecs(r);
    } catch (err) {
      setError(err?.message ?? "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submitAction = async (event) => {
    event.preventDefault();
    const summary = String(actionNote ?? "").trim();
    if (!summary) {
      return;
    }
    setActionSaving(true);
    setError("");
    try {
      await recordOperationalActionRequest({
        summary,
        department: actionDept.trim(),
        source: "alerts_ui"
      });
      setActionNote("");
      setActionDept("");
    } catch (err) {
      setError(err?.message ?? "Could not record action");
    } finally {
      setActionSaving(false);
    }
  };

  const ack = async (id = "") => {
    if (!id) {
      return;
    }
    setBusyId(id);
    setError("");
    try {
      await acknowledgeAlertRequest(id);
      await load();
    } catch (err) {
      setError(err?.message ?? "Ack failed");
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Operational alerts</h1>
          <p className="page-subtitle">Rule-based thresholds evaluated against the live queue.</p>
        </div>
        <button type="button" onClick={load} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {error ? <p className="error-text">{error}</p> : null}

      {recs?.recommendations?.length ? (
        <article className="card" style={{ marginBottom: 18 }}>
          <h3>Recommendations</h3>
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

      {loading && !rows.length ? <p>Loading…</p> : null}

      <article className="card table-card">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Type</th>
              <th>Department</th>
              <th>Message</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id}>
                <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}</td>
                <td>{row.type}</td>
                <td>{row.department}</td>
                <td>{row.message}</td>
                <td>
                  {row.acknowledged_at ? (
                    <span className="muted-inline">Acknowledged</span>
                  ) : (
                    <button type="button" disabled={busyId === row._id} onClick={() => ack(row._id)}>
                      {busyId === row._id ? "…" : "Acknowledge"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && !loading ? <p className="muted">No alerts yet.</p> : null}
      </article>

      <article className="card" style={{ marginTop: 18 }}>
        <h3>Log operational action (learning loop)</h3>
        <p className="page-subtitle">
          Record what the team did in response to load or alerts. Used with intelligence summaries for the
          feedback loop.
        </p>
        <form className="action-log-form" onSubmit={submitAction}>
          <label htmlFor="action_dept">Department (optional)</label>
          <input
            id="action_dept"
            value={actionDept}
            onChange={(e) => setActionDept(e.target.value)}
            placeholder="e.g. Emergency"
          />
          <label htmlFor="action_summary">Summary</label>
          <textarea
            id="action_summary"
            required
            rows={3}
            value={actionNote}
            onChange={(e) => setActionNote(e.target.value)}
            placeholder="e.g. Opened second triage desk for 2h"
          />
          <button type="submit" disabled={actionSaving}>
            {actionSaving ? "Saving…" : "Save action"}
          </button>
        </form>
      </article>
    </section>
  );
};
