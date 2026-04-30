import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDepartmentFunnel } from "../services/journeyService";
import { fetchHisDepartments } from "../services/dashboardService";
import { fetchAlertRecommendations } from "../services/alertService";
import {
  fetchIntelligenceSummary,
  refreshModelVersionRequest
} from "../services/intelligenceService";

const todayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};
const toMinutes = (value = null) => (value == null ? "-" : `${value} min`);
const toPercent = (value = null) => (value == null ? "-" : `${value}%`);

export const DepartmentAnalyticsPage = () => {
  const [funnel, setFunnel] = useState(null);
  const [intelSummary, setIntelSummary] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshingModel, setRefreshingModel] = useState(false);
  const [department, setDepartment] = useState("");
  const [departments, setDepartments] = useState([]);
  const role = localStorage.getItem("auth_role") ?? "nurse";

  const { fromIso, toIso } = useMemo(() => {
    const { start, end } = todayRange();
    return { fromIso: start.toISOString(), toIso: end.toISOString() };
  }, []);

  const completionRate = useMemo(() => {
    if (!funnel?.total_visits) {
      return 0;
    }
    return Math.round(((funnel.completed_status ?? 0) / funnel.total_visits) * 100);
  }, [funnel]);

  const consultRate = useMemo(() => {
    if (!funnel?.total_visits) {
      return 0;
    }
    return Math.round(((funnel.reached_consult_end ?? 0) / funnel.total_visits) * 100);
  }, [funnel]);

  const labRate = useMemo(() => {
    if (!funnel?.total_visits) {
      return 0;
    }
    return Math.round(((funnel.touched_lab ?? 0) / funnel.total_visits) * 100);
  }, [funnel]);

  const treatmentRate = useMemo(() => {
    if (!funnel?.total_visits) {
      return 0;
    }
    return Math.round(((funnel.touched_treatment ?? 0) / funnel.total_visits) * 100);
  }, [funnel]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { from: fromIso, to: toIso };
      if (department) {
        params.department = department;
      }
      const [funnelData, intelData, recData] = await Promise.all([
        fetchDepartmentFunnel(params),
        fetchIntelligenceSummary().catch(() => null),
        fetchAlertRecommendations().catch(() => null)
      ]);
      setFunnel(funnelData);
      setIntelSummary(intelData);
      setRecommendations(recData);
    } catch (err) {
      setError(err?.message ?? "Unable to load funnel");
      setFunnel(null);
      setIntelSummary(null);
      setRecommendations(null);
    } finally {
      setLoading(false);
    }
  }, [fromIso, toIso, department]);

  const handleRefreshModel = async () => {
    setRefreshingModel(true);
    setError("");
    try {
      await refreshModelVersionRequest();
      await load();
    } catch (err) {
      setError(err?.message ?? "Model refresh failed");
    } finally {
      setRefreshingModel(false);
    }
  };

  useEffect(() => {
    fetchHisDepartments()
      .then((list) => setDepartments(Array.isArray(list) ? list : []))
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Department journey funnel</h1>
          <p className="page-subtitle">
            One-session analytics view: operational AI insights + department drill-downs.
          </p>
        </div>
        <div className="filter-row">
          <label htmlFor="funnel_dept">
            Department
            <select
              id="funnel_dept"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
            >
              <option value="">All departments</option>
              {departments.map((d) => {
                const deptName = String(d?.dept_name ?? d?.department ?? "").trim();
                if (!deptName) {
                  return null;
                }
                return (
                  <option key={d.dept_id ?? deptName} value={deptName}>
                    {deptName}
                  </option>
                );
              })}
            </select>
          </label>
          <button type="button" onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          {role === "admin" ? (
            <button
              type="button"
              onClick={handleRefreshModel}
              disabled={refreshingModel || loading}
            >
              {refreshingModel ? "Refreshing model…" : "Refresh model version"}
            </button>
          ) : null}
        </div>
      </header>

      {error ? <p className="error-text">{error}</p> : null}

      {loading && !funnel ? <p>Loading funnel…</p> : null}

      {funnel ? (
        <>
          {recommendations?.recommendations?.length ? (
            <article className="card" style={{ marginBottom: 16 }}>
              <h3>Operational recommendations</h3>
              <ul className="recs-list">
                {recommendations.recommendations.map((line, idx) => (
                  <li key={`combined-rec-${idx}`}>
                    <strong>{line.title}</strong>
                    <p>{line.recommendation}</p>
                  </li>
                ))}
              </ul>
            </article>
          ) : null}

          <article className="card ai-principle-card">
            <h3>AI insight: explainable causal ops</h3>
            <p className="page-subtitle">
              Every insight includes what changed, who contributed most, why, confidence, and recommended action.
            </p>
            <div className="ai-summary-grid">
              <div className="ai-summary-item">
                <span className="ai-key">What happened</span>
                <strong>{funnel.ai_insight?.summary?.what_happened ?? "-"}</strong>
              </div>
              <div className="ai-summary-item">
                <span className="ai-key">Top contributor</span>
                <strong>{funnel.ai_insight?.summary?.who_contributed_most ?? "-"}</strong>
              </div>
              <div className="ai-summary-item">
                <span className="ai-key">Root cause stage</span>
                <strong>{funnel.ai_insight?.summary?.why ?? "-"}</strong>
              </div>
              <div className="ai-summary-item">
                <span className="ai-key">Confidence</span>
                <strong className={`confidence-chip ${funnel.ai_insight?.summary?.confidence ?? "low"}`}>
                  {funnel.ai_insight?.summary?.confidence ?? "low"}
                </strong>
              </div>
            </div>
            <div className="ai-action-box">
              <span className="ai-key">Recommended action</span>
              <p>{funnel.ai_insight?.summary?.recommended_action ?? "-"}</p>
            </div>
          </article>

          <div className="funnel-grid">
            <article className="card funnel-card">
              <p>Total visits (range)</p>
              <h2>{funnel.total_visits}</h2>
            </article>
            <article className="card funnel-card">
              <p>Reached consult end</p>
              <h2>{funnel.reached_consult_end}</h2>
            </article>
            <article className="card funnel-card">
              <p>Touched lab</p>
              <h2>{funnel.touched_lab}</h2>
            </article>
            <article className="card funnel-card">
              <p>Touched treatment</p>
              <h2>{funnel.touched_treatment}</h2>
            </article>
            <article className="card funnel-card">
              <p>Completed (status)</p>
              <h2>{funnel.completed_status}</h2>
            </article>
            <article className="card funnel-card">
              <p>Long-wait share (&gt;30m)</p>
              <h2>{toPercent(funnel.long_wait_share_pct ?? 0)}</h2>
            </article>
            <article className="card funnel-card">
              <p>Global wait (avg / median)</p>
              <h2>{toMinutes(funnel.avg_waiting_minutes_global)}</h2>
              <small>{toMinutes(funnel.median_waiting_minutes_global)} median</small>
            </article>
          </div>

          <article className="card infographic-section" style={{ marginTop: 16 }}>
            <h3>Infographic snapshot</h3>
            <div className="infographic-grid">
              <div className="infographic-ring-card">
                <p className="infographic-label">Completion rate</p>
                <div
                  className="completion-ring"
                  style={{ "--pct": `${completionRate}%` }}
                  aria-label={`Completion rate ${completionRate}%`}
                >
                  <span>{completionRate}%</span>
                </div>
                <small>{funnel.completed_status} of {funnel.total_visits} visits completed</small>
              </div>
              <div className="infographic-bars-card">
                <p className="infographic-label">Stage conversion</p>
                <div className="stage-row">
                  <span>Consult done</span>
                  <div className="stage-track"><div className="stage-fill consult" style={{ width: `${consultRate}%` }} /></div>
                  <strong>{consultRate}%</strong>
                </div>
                <div className="stage-row">
                  <span>Lab touched</span>
                  <div className="stage-track"><div className="stage-fill lab" style={{ width: `${labRate}%` }} /></div>
                  <strong>{labRate}%</strong>
                </div>
                <div className="stage-row">
                  <span>Treatment touched</span>
                  <div className="stage-track"><div className="stage-fill treatment" style={{ width: `${treatmentRate}%` }} /></div>
                  <strong>{treatmentRate}%</strong>
                </div>
              </div>
            </div>
          </article>

          <article className="card" style={{ marginTop: 16 }}>
            <h3>Department patient counts</h3>
            <div className="table-card">
              <table>
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Patients</th>
                  </tr>
                </thead>
                <tbody>
                  {(funnel.department_breakdown ?? []).map((row) => (
                    <tr key={`dept-count-${row.department}`}>
                      <td>{row.department}</td>
                      <td>{row.total_visits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="card" style={{ marginTop: 16 }}>
            <h3>Where patients spend most time</h3>
            <div className="table-card">
              <table>
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Avg waiting</th>
                    <th>Avg consult</th>
                    <th>Avg treatment</th>
                    <th>Main bottleneck</th>
                  </tr>
                </thead>
                <tbody>
                  {(funnel.department_breakdown ?? []).map((row) => (
                    <tr key={`dept-insight-${row.department}`}>
                      <td>{row.department}</td>
                      <td>{row.avg_waiting_minutes ?? "-"}</td>
                      <td>{row.avg_consulting_minutes ?? "-"}</td>
                      <td>{row.avg_treatment_minutes ?? "-"}</td>
                      <td>
                        {row.bottleneck_stage === "none"
                          ? "-"
                          : `${row.bottleneck_stage} (${row.bottleneck_minutes ?? "-"} min)`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="card" style={{ marginTop: 16 }}>
            <h3>Department contribution ranking (causal attribution)</h3>
            <div className="table-card">
              <table>
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Contribution</th>
                    <th>Wait delta</th>
                    <th>Consult delta</th>
                    <th>Treatment delta</th>
                    <th>Stage driver</th>
                    <th>Sample</th>
                  </tr>
                </thead>
                <tbody>
                  {(funnel.ai_insight?.contributors_ranked ?? []).map((row) => (
                    <tr key={`ai-rank-${row.department}`}>
                      <td>{row.department}</td>
                      <td>{toPercent(row.contribution_pct)}</td>
                      <td>{toMinutes(row.deltas?.waiting_minutes)}</td>
                      <td>{toMinutes(row.deltas?.consulting_minutes)}</td>
                      <td>{toMinutes(row.deltas?.treatment_minutes)}</td>
                      <td>{row.dominant_stage_driver ?? "-"}</td>
                      <td>{row.sample_size ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="card" style={{ marginTop: 16 }}>
            <h3>Department stage distribution (mini charts)</h3>
            <div className="dept-mini-grid">
              {(funnel.department_breakdown ?? []).map((row) => {
                const total = Math.max(row.total_visits ?? 0, 1);
                const wait = Math.max(0, total - (row.reached_consult_end ?? 0));
                const consult = Math.max(0, (row.reached_consult_end ?? 0) - (row.touched_treatment ?? 0));
                const treat = Math.max(0, row.touched_treatment ?? 0);
                const waitPct = Math.round((wait / total) * 100);
                const consultPct = Math.round((consult / total) * 100);
                const treatPct = Math.max(0, 100 - waitPct - consultPct);
                return (
                  <article key={`mini-${row.department}`} className="dept-mini-card">
                    <div className="dept-mini-head">
                      <strong>{row.department}</strong>
                      <span>{row.total_visits} visits</span>
                    </div>
                    <div className="mini-stack">
                      <div className="mini-seg waiting" style={{ width: `${waitPct}%` }} />
                      <div className="mini-seg consulting" style={{ width: `${consultPct}%` }} />
                      <div className="mini-seg treatment" style={{ width: `${treatPct}%` }} />
                    </div>
                    <div className="mini-legend">
                      <span><i className="dot waiting" />Wait {waitPct}%</span>
                      <span><i className="dot consulting" />Consult {consultPct}%</span>
                      <span><i className="dot treatment" />Treat {treatPct}%</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </article>
        </>
      ) : null}
    </section>
  );
};
