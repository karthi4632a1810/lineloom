import { useCallback, useEffect, useMemo, useState } from "react";
import { ClinicalPageHeader } from "../components/clinical/PagePrimitives.jsx";
import { InfographicChartGrid } from "../components/infographic/InfographicChartGrid.jsx";
import { fetchDepartmentFunnel } from "../services/journeyService";
import { fetchHisDepartments } from "../services/dashboardService";
import { fetchAlertRecommendations } from "../services/alertService";
import { refreshModelVersionRequest } from "../services/intelligenceService";

const getTodayDateInputValue = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const toMinutes = (value = null) => (value == null ? "-" : `${value} min`);
const toPercent = (value = null) => (value == null ? "-" : `${value}%`);

/** Analytics dashboard — funnel, conversion, and department insights. */
export const DepartmentAnalyticsPage = () => {
  const [funnel, setFunnel] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshingModel, setRefreshingModel] = useState(false);
  const [department, setDepartment] = useState("");
  const [departments, setDepartments] = useState([]);
  const [dateFrom, setDateFrom] = useState(() => getTodayDateInputValue());
  const [dateTo, setDateTo] = useState(() => getTodayDateInputValue());
  const role = localStorage.getItem("auth_role") ?? "nurse";

  const { fromIso, toIso } = useMemo(() => {
    const start = new Date(`${dateFrom}T00:00:00`);
    const end = new Date(`${dateTo}T23:59:59.999`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      const { start: s, end: e } = (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return { start: today, end: tomorrow };
      })();
      return { fromIso: s.toISOString(), toIso: e.toISOString() };
    }
    if (end < start) {
      return { fromIso: start.toISOString(), toIso: start.toISOString() };
    }
    return { fromIso: start.toISOString(), toIso: end.toISOString() };
  }, [dateFrom, dateTo]);

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
      const [funnelData, recData] = await Promise.all([
        fetchDepartmentFunnel(params),
        fetchAlertRecommendations().catch(() => null)
      ]);
      setFunnel(funnelData);
      setRecommendations(recData);
    } catch (err) {
      setError(err?.message ?? "Unable to load dashboard");
      setFunnel(null);
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

  const handleApplyFilters = (event) => {
    event.preventDefault();
    load();
  };

  useEffect(() => {
    fetchHisDepartments()
      .then((list) => setDepartments(Array.isArray(list) ? list : []))
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const departmentOptions = useMemo(
    () =>
      departments
        .map((d) => String(d?.dept_name ?? d?.department ?? "").trim())
        .filter(Boolean),
    [departments]
  );

  return (
    <section className="page cc-page infographic-page nf-info-modern queue-layout-page">
      <ClinicalPageHeader
        title="Infographic"
        subtitle="Visual charts for visit outcomes, funnel stages, departments, and wait times."
      />

      <form className="nf-lq-toolbar nf-info-modern-toolbar" onSubmit={handleApplyFilters}>
        <div className="nf-panel-head">
          <h2 className="nf-panel-title">Filters</h2>
          <p className="nf-panel-sub">Date range and department for metrics below.</p>
        </div>
        <div className="nf-lq-toolbar-fields nf-lq-toolbar-fields--overview">
          <div className="nf-lq-field">
            <label htmlFor="dash_analytics_from">From</label>
            <input
              id="dash_analytics_from"
              type="date"
              name="date_from"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="nf-lq-input"
            />
          </div>
          <div className="nf-lq-field">
            <label htmlFor="dash_analytics_to">To</label>
            <input
              id="dash_analytics_to"
              type="date"
              name="date_to"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="nf-lq-input"
            />
          </div>
          <div className="nf-lq-field">
            <label htmlFor="dash_analytics_dept">Department</label>
            <select
              id="dash_analytics_dept"
              name="department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              className="nf-lq-input"
            >
              <option value="">All departments</option>
              {departmentOptions.map((deptName) => (
                <option key={deptName} value={deptName}>
                  {deptName}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="nf-lq-toolbar-actions">
          <button type="submit" className="nf-lq-btn nf-lq-btn--primary" disabled={loading}>
            {loading ? "Loading…" : "Apply filters"}
          </button>
          {role === "admin" ? (
            <button
              type="button"
              className="nf-lq-btn"
              onClick={handleRefreshModel}
              disabled={refreshingModel || loading}
            >
              {refreshingModel ? "Refreshing model…" : "Refresh model"}
            </button>
          ) : null}
        </div>
      </form>

      {error ? <p className="error-text">{error}</p> : null}
      {loading && !funnel ? <p className="muted-inline">Loading dashboard…</p> : null}

      {funnel ? (
        <>
          <div className="nf-stat-grid summary-grid nf-info-modern-stats" aria-label="Visit summary">
            <article className="summary-card nf-stat-card nf-stat-card--waiting">
              <h4>Total visits</h4>
              <p className="nf-stat-value">{funnel.total_visits ?? 0}</p>
              <span className="nf-stat-caption">in selected range</span>
            </article>
            <article className="summary-card nf-stat-card nf-stat-card--consult">
              <h4>Consult completed</h4>
              <p className="nf-stat-value">{funnel.reached_consult_end ?? 0}</p>
              <span className="nf-stat-caption">{consultRate}% of visits</span>
            </article>
            <article className="summary-card nf-stat-card nf-stat-card--treatment">
              <h4>Lab touched</h4>
              <p className="nf-stat-value">{funnel.touched_lab ?? 0}</p>
              <span className="nf-stat-caption">{labRate}% of visits</span>
            </article>
            <article className="summary-card nf-stat-card nf-stat-card--done">
              <h4>Completed</h4>
              <p className="nf-stat-value">{funnel.completed_status ?? 0}</p>
              <span className="nf-stat-caption">{completionRate}% completion</span>
            </article>
          </div>

          <article className="nf-panel nf-dashboard-panel nf-infographic-panel nf-info-modern-charts">
            <div className="nf-panel-head">
              <h2 className="nf-panel-title">Infographic charts</h2>
              <p className="nf-panel-sub">
                Pie and bar views for completion, journey stages, departments, and bottlenecks.
              </p>
            </div>
            <div className="nf-panel-body">
              <InfographicChartGrid
                funnel={funnel}
                completionRate={completionRate}
                consultRate={consultRate}
                labRate={labRate}
                treatmentRate={treatmentRate}
              />
            </div>
          </article>

          {recommendations?.recommendations?.length ? (
            <article className="nf-panel nf-dashboard-panel nf-info-modern-panel">
              <div className="nf-panel-head">
                <h2 className="nf-panel-title">Operational recommendations</h2>
              </div>
              <ul className="recs-list nf-panel-body">
                {recommendations.recommendations.map((line, idx) => (
                  <li key={`combined-rec-${idx}`}>
                    <strong>{line.title}</strong>
                    <p>{line.recommendation}</p>
                  </li>
                ))}
              </ul>
            </article>
          ) : null}

          <article className="nf-panel nf-dashboard-panel ai-principle-card nf-info-modern-panel">
            <div className="nf-panel-head">
              <h2 className="nf-panel-title">AI insight</h2>
              <p className="nf-panel-sub">What changed, who contributed most, and recommended action.</p>
            </div>
            <div className="nf-panel-body">
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
            </div>
          </article>

          <article className="nf-panel nf-dashboard-panel nf-info-modern-panel">
            <div className="nf-panel-head">
              <h2 className="nf-panel-title">Department patient counts</h2>
            </div>
            <div className="nf-panel-body token-search-table-wrap">
              <table className="token-search-table nf-queue-table">
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

          <article className="nf-panel nf-dashboard-panel nf-info-modern-panel">
            <div className="nf-panel-head">
              <h2 className="nf-panel-title">Where patients spend most time</h2>
            </div>
            <div className="nf-panel-body token-search-table-wrap">
              <table className="token-search-table nf-queue-table">
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

          <article className="nf-panel nf-dashboard-panel nf-info-modern-panel">
            <div className="nf-panel-head">
              <h2 className="nf-panel-title">Department contribution ranking</h2>
              <p className="nf-panel-sub">Causal attribution by department.</p>
            </div>
            <div className="nf-panel-body token-search-table-wrap">
              <table className="token-search-table nf-queue-table">
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

          <article className="nf-panel nf-dashboard-panel nf-info-modern-panel">
            <div className="nf-panel-head">
              <h2 className="nf-panel-title">Department stage distribution</h2>
            </div>
            <div className="nf-panel-body dept-mini-grid">
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
                      <span>
                        <i className="dot waiting" />
                        Wait {waitPct}%
                      </span>
                      <span>
                        <i className="dot consulting" />
                        Consult {consultPct}%
                      </span>
                      <span>
                        <i className="dot treatment" />
                        Treat {treatPct}%
                      </span>
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
