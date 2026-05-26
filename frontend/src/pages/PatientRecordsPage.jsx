import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { searchHisPatients } from "../services/hisService";
import { fetchTokenJourney } from "../services/journeyService";
import { fetchPatientRecord } from "../services/patientRecordsService";
import { getVisitPhaseChipClass } from "../utils/revertAnchors";

const initialSearch = {
  patient_id: "",
  name: "",
  reg_no: "",
  date_from: "",
  date_to: ""
};

const parseTime = (value = null) => {
  if (!value) {
    return 0;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

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

const formatDateOnly = (value = null) => {
  if (!value) {
    return "--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString();
};

const formatMinutes = (value = null) => {
  if (value == null || value === "") {
    return "--";
  }
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) {
    return "--";
  }
  if (minutes < 60) {
    return `${minutes.toFixed(minutes < 10 ? 1 : 0)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
};

const formatCurrency = (value = 0) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(value ?? 0) || 0);

const getInitials = (name = "") =>
  String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? "")
    .join("") || "PR";

const getWorkflowBadges = (encounter = {}) => {
  const items = [];
  if (encounter?.flags?.tracked) {
    items.push("Tracked");
  }
  if (encounter?.flags?.has_billing) {
    items.push("Billing");
  }
  if (encounter?.flags?.has_lab) {
    items.push("Lab");
  }
  if (encounter?.flags?.has_pharmacy) {
    items.push("Pharmacy");
  }
  if (encounter?.flags?.has_treatment) {
    items.push("Treatment");
  }
  if (encounter?.flags?.has_referral) {
    items.push("Referral");
  }
  if (!items.length) {
    items.push("No workflow data");
  }
  return items;
};

const getEncounterChipClass = (encounter = {}) => {
  if (encounter?.phase === "his_only" || encounter?.status === "HIS_ONLY") {
    return "patient-records-status-untracked";
  }
  return getVisitPhaseChipClass({
    status: encounter?.status,
    consult_start: encounter?.time_tracking?.consult_start ?? null,
    consult_end: encounter?.time_tracking?.consult_end ?? null,
    billing_start: encounter?.time_tracking?.billing_start ?? null,
    billing_end: encounter?.time_tracking?.billing_end ?? null,
    lab_start: encounter?.time_tracking?.lab_start ?? null,
    lab_end: encounter?.time_tracking?.lab_end ?? null,
    care_start: encounter?.time_tracking?.care_start ?? null,
    care_end: encounter?.time_tracking?.care_end ?? null,
    treatment_start: encounter?.time_tracking?.care_start ?? null,
    treatment_end: encounter?.time_tracking?.care_end ?? null
  });
};

const JourneyTimeline = ({ loading = false, error = "", steps = [], tracked = false }) => {
  if (!tracked) {
    return <p className="muted-inline">No LineLoom token timeline exists for this HIS-only visit.</p>;
  }
  if (loading) {
    return <p className="muted-inline">Loading visit timeline...</p>;
  }
  if (error) {
    return <p className="error-text">{error}</p>;
  }
  if (!steps.length) {
    return <p className="muted-inline">No journey steps are available for this token yet.</p>;
  }

  return (
    <div className="journey-list journey-graph">
      {steps.map((step, index) => {
        const kindKey = String(step?.kind ?? "")
          .toLowerCase()
          .replaceAll("_", "");
        const isLast = index === steps.length - 1;
        return (
          <div
            key={`${step?.id ?? index}`}
            className={`journey-step ${step?.in_progress ? "active" : ""} ${
              kindKey ? `journey-kind-${kindKey}` : ""
            } ${isLast ? "journey-step-last" : ""}`.trim()}
          >
            <span className={`dot ${step?.end ? "done" : ""}`}>{index + 1}</span>
            <div className="journey-step-body">
              <strong>{step?.label ?? "Step"}</strong>
              <p className="journey-step-time">
                {formatDateTime(step?.start)}
                {step?.end ? ` -> ${formatDateTime(step.end)}` : ""}
              </p>
              <p className="journey-step-sub">
                {step?.duration_minutes != null
                  ? `${formatMinutes(step.duration_minutes)}`
                  : "Duration unavailable"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const LogList = ({ title = "", logs = [] }) => {
  if (!logs.length) {
    return null;
  }
  return (
    <div className="patient-records-subsection">
      <h4>{title}</h4>
      <div className="patient-records-log-list">
        {logs.map((entry, index) => (
          <div key={`${title}-${entry.id}-${index}`} className="patient-records-log-row">
            <strong>{title} #{index + 1}</strong>
            <span>{formatDateTime(entry.start)}</span>
            <span>{entry.end ? formatDateTime(entry.end) : "In progress"}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const PatientRecordsPage = () => {
  const [filters, setFilters] = useState(initialSearch);
  const [searchRows, setSearchRows] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [record, setRecord] = useState(null);
  const [recordError, setRecordError] = useState("");
  const [isRecordLoading, setIsRecordLoading] = useState(false);
  const [selectedEncounterKey, setSelectedEncounterKey] = useState("");

  const [journeyState, setJourneyState] = useState({
    loading: false,
    error: "",
    data: null
  });

  const groupedPatients = useMemo(() => {
    const grouped = searchRows.reduce((acc, row) => {
      const patientId = String(row?.patient_id ?? "").trim();
      if (!patientId) {
        return acc;
      }
      const current = acc[patientId];
      const rowAdmission = parseTime(row?.admission);
      if (!current || rowAdmission > parseTime(current.latest_admission)) {
        acc[patientId] = {
          patient_id: patientId,
          name: String(row?.c_pat_name ?? row?.name ?? "").trim(),
          sex: String(row?.c_sex ?? "").trim(),
          dob: row?.d_dob ?? "",
          i_reg_no: String(row?.i_reg_no ?? "").trim(),
          latest_visit_id: String(row?.visit_id ?? "").trim(),
          latest_admission: row?.admission ?? "",
          latest_department: String(row?.dept_name ?? row?.department ?? "").trim(),
          latest_type: String(row?.type ?? "").trim(),
          match_count: current?.match_count ?? 0
        };
      }
      acc[patientId].match_count = (acc[patientId]?.match_count ?? 0) + 1;
      return acc;
    }, {});

    return Object.values(grouped).sort(
      (left, right) => parseTime(right.latest_admission) - parseTime(left.latest_admission)
    );
  }, [searchRows]);

  const selectedEncounter = useMemo(() => {
    const encounters = record?.encounters ?? [];
    if (!encounters.length) {
      return null;
    }
    return (
      encounters.find((entry) => entry.encounter_key === selectedEncounterKey) ?? encounters[0] ?? null
    );
  }, [record, selectedEncounterKey]);

  useEffect(() => {
    const encounters = record?.encounters ?? [];
    if (!encounters.length) {
      setSelectedEncounterKey("");
      return;
    }
    setSelectedEncounterKey((current) => {
      if (encounters.some((entry) => entry.encounter_key === current)) {
        return current;
      }
      return encounters[0].encounter_key;
    });
  }, [record]);

  useEffect(() => {
    let cancelled = false;

    const loadJourney = async () => {
      if (!selectedEncounter?.journey_available || !selectedEncounter?.token_id) {
        setJourneyState({ loading: false, error: "", data: null });
        return;
      }

      setJourneyState({ loading: true, error: "", data: null });
      try {
        const data = await fetchTokenJourney(selectedEncounter.token_id);
        if (!cancelled) {
          setJourneyState({ loading: false, error: "", data });
        }
      } catch (error) {
        if (!cancelled) {
          setJourneyState({
            loading: false,
            error: error?.message ?? "Unable to load journey timeline",
            data: null
          });
        }
      }
    };

    loadJourney();
    return () => {
      cancelled = true;
    };
  }, [selectedEncounter?.journey_available, selectedEncounter?.token_id]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((previous) => ({ ...previous, [name]: value }));
  };

  const loadRecord = async (patientId = "") => {
    const id = String(patientId ?? "").trim();
    if (!id) {
      return;
    }
    setSelectedPatientId(id);
    setIsRecordLoading(true);
    setRecordError("");
    try {
      const payload = await fetchPatientRecord(id);
      setRecord(payload);
    } catch (error) {
      setRecord(null);
      setRecordError(error?.message ?? "Unable to load patient record");
    } finally {
      setIsRecordLoading(false);
    }
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    const hasAnyFilter = Object.values(filters).some((value) => String(value ?? "").trim());
    if (!hasAnyFilter) {
      setSearchError("Enter at least one search filter to look up patient records.");
      setHasSearched(true);
      setSearchRows([]);
      return;
    }

    setIsSearching(true);
    setSearchError("");
    setHasSearched(true);
    try {
      const rows = await searchHisPatients(filters);
      setSearchRows(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setSearchRows([]);
      setSearchError(error?.message ?? "Unable to search patient records");
    } finally {
      setIsSearching(false);
    }
  };

  const handleClear = () => {
    setFilters(initialSearch);
    setSearchRows([]);
    setHasSearched(false);
    setSearchError("");
    setSelectedPatientId("");
    setRecord(null);
    setRecordError("");
    setSelectedEncounterKey("");
    setJourneyState({ loading: false, error: "", data: null });
  };

  const summary = record?.summary ?? {};
  const patient = record?.patient ?? {};
  const journeySteps = Array.isArray(journeyState.data?.timeline) ? journeyState.data.timeline : [];

  return (
    <section className="page patient-records-page">
      <div className="page-header">
        <div>
          <h1>Patient Records</h1>
          <p className="page-subtitle">
            Search patients from HIS, review visit history, and drill into tracked token journeys.
          </p>
        </div>
      </div>

      <form className="card token-search-card token-search-filters patient-records-search-card" onSubmit={handleSearch}>
        <div className="token-search-fields">
          <label className="token-search-field">
            <span>Patient ID / Visit No</span>
            <input
              type="text"
              name="patient_id"
              value={filters.patient_id}
              onChange={handleFilterChange}
              placeholder="Patient id or visit number"
              autoComplete="off"
            />
          </label>
          <label className="token-search-field">
            <span>Patient name</span>
            <input
              type="text"
              name="name"
              value={filters.name}
              onChange={handleFilterChange}
              placeholder="Contains match"
              autoComplete="off"
            />
          </label>
          <label className="token-search-field">
            <span>IP / OP reg no / iReg_No</span>
            <input
              type="text"
              name="reg_no"
              value={filters.reg_no}
              onChange={handleFilterChange}
              placeholder="Reg no or internal reg"
              autoComplete="off"
            />
          </label>
          <label className="token-search-field">
            <span>Admission from</span>
            <input type="date" name="date_from" value={filters.date_from} onChange={handleFilterChange} />
          </label>
          <label className="token-search-field">
            <span>Admission to</span>
            <input type="date" name="date_to" value={filters.date_to} onChange={handleFilterChange} />
          </label>
        </div>
        <div className="token-search-actions patient-records-search-actions">
          <button type="submit" disabled={isSearching}>
            {isSearching ? "Searching..." : "Search"}
          </button>
          <button type="button" className="btn-secondary" onClick={handleClear}>
            Clear
          </button>
        </div>
      </form>

      {searchError ? <p className="error-text">{searchError}</p> : null}

      <article className="card token-search-results-card patient-records-search-results">
        <div className="patient-records-section-head">
          <div>
            <h3>Search Results</h3>
            <p className="page-subtitle">Select a patient to load their read-only record summary.</p>
          </div>
        </div>
        {!hasSearched ? (
          <p className="muted-inline">
            Search by patient id, visit number, registration number, name, or admission date.
          </p>
        ) : null}
        {hasSearched && !groupedPatients.length && !searchError ? (
          <p className="muted-inline">No patients matched the current filters.</p>
        ) : null}
        {groupedPatients.length ? (
          <div className="token-search-table-wrap">
            <table className="token-search-table patient-records-search-table">
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th>Name</th>
                  <th>Sex</th>
                  <th>DOB</th>
                  <th>iReg_No</th>
                  <th>Latest visit</th>
                  <th>Department</th>
                  <th>Matches</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {groupedPatients.map((row) => (
                  <tr
                    key={row.patient_id}
                    className={row.patient_id === selectedPatientId ? "patient-records-row-active" : ""}
                  >
                    <td>{row.patient_id}</td>
                    <td>{row.name || "--"}</td>
                    <td>{row.sex || "--"}</td>
                    <td>{formatDateOnly(row.dob)}</td>
                    <td>{row.i_reg_no || "--"}</td>
                    <td>
                      <div>{row.latest_visit_id || "--"}</div>
                      <small className="muted-inline">{formatDateTime(row.latest_admission)}</small>
                    </td>
                    <td>
                      {row.latest_department || "--"}
                      {row.latest_type ? (
                        <span className="visit-type-pill" data-type={row.latest_type}>
                          {row.latest_type}
                        </span>
                      ) : null}
                    </td>
                    <td>{row.match_count}</td>
                    <td>
                      <button type="button" onClick={() => loadRecord(row.patient_id)}>
                        Open record
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>

      {isRecordLoading ? <section className="page"><p>Loading patient record...</p></section> : null}
      {recordError ? <p className="error-text">{recordError}</p> : null}

      {record ? (
        <>
          <header className="detail-header patient-records-header">
            <div className="patient-hero">
              <div className="patient-avatar">{getInitials(patient.name)}</div>
              <div>
                <div className="patient-title-row">
                  <h2>{patient.name || `Patient ${patient.patient_id}`}</h2>
                  <span className="patient-chip">Patient ID {patient.patient_id}</span>
                </div>
                <p className="patient-meta">
                  {patient.phone || "No phone"} | {patient.sex || "Sex unknown"} | DOB {formatDateOnly(patient.dob)}
                </p>
                <div className="patient-tags">
                  {patient.i_reg_no ? <span>iReg_No {patient.i_reg_no}</span> : null}
                  {summary.latest_department ? <span>{summary.latest_department}</span> : null}
                  {summary.latest_status ? (
                    summary.latest_status === "HIS ONLY" ? (
                      <span className="status-chip patient-records-status-untracked">HIS ONLY</span>
                    ) : (
                      <span className={`status-chip ${getEncounterChipClass(record?.encounters?.[0] ?? {})}`}>
                        {summary.latest_status}
                      </span>
                    )
                  ) : null}
                </div>
              </div>
            </div>
            <div className="patient-records-header-meta">
              <div className="patient-records-meta-card">
                <span>Last seen</span>
                <strong>{formatDateTime(summary.last_seen_at)}</strong>
              </div>
              <div className="patient-records-meta-card">
                <span>Latest token</span>
                <strong>{summary.latest_token_id || "--"}</strong>
              </div>
            </div>
          </header>

          <section className="summary-grid patient-records-summary-grid">
            <article className="summary-card">
              <h4>Total visits</h4>
              <p>{summary.total_visits ?? 0}</p>
            </article>
            <article className="summary-card">
              <h4>Tracked encounters</h4>
              <p>{summary.tracked_encounters ?? 0}</p>
            </article>
            <article className="summary-card">
              <h4>Active encounters</h4>
              <p>{summary.active_encounters ?? 0}</p>
            </article>
            <article className="summary-card">
              <h4>Completed</h4>
              <p>{summary.completed_encounters ?? 0}</p>
            </article>
            <article className="summary-card">
              <h4>HIS only visits</h4>
              <p>{summary.his_only_visits ?? 0}</p>
            </article>
            <article className="summary-card">
              <h4>Departments visited</h4>
              <p>{summary.departments_visited ?? 0}</p>
            </article>
          </section>

          <section className="patient-records-layout">
            <article className="card table-card patient-records-history-card">
              <div className="patient-records-section-head">
                <div>
                  <h3>Visit History</h3>
                  <p className="page-subtitle">
                    Tracked token episodes appear with workflow metrics; HIS-only visits remain visible for context.
                  </p>
                </div>
              </div>
              {!record?.encounters?.length ? (
                <p className="muted-inline">No visit history is available for this patient.</p>
              ) : (
                <table className="patient-records-history-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Visit ID</th>
                      <th>Token</th>
                      <th>Department</th>
                      <th>Status</th>
                      <th>Overall TAT</th>
                      <th>Consult</th>
                      <th>Workflow</th>
                      <th>Note</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.encounters.map((encounter) => (
                      <tr
                        key={encounter.encounter_key}
                        className={`clickable-row ${
                          selectedEncounter?.encounter_key === encounter.encounter_key
                            ? "patient-records-row-active"
                            : ""
                        }`.trim()}
                        onClick={() => setSelectedEncounterKey(encounter.encounter_key)}
                      >
                        <td>
                          <div>{formatDateOnly(encounter.occurred_at || encounter.admission)}</div>
                          <small className="muted-inline">{formatDateTime(encounter.occurred_at || encounter.admission)}</small>
                        </td>
                        <td>
                          <strong>{encounter.visit_id || "--"}</strong>
                          {encounter.type ? (
                            <span className="visit-type-pill" data-type={encounter.type}>
                              {encounter.type}
                            </span>
                          ) : null}
                        </td>
                        <td>{encounter.token_id || "--"}</td>
                        <td>{encounter.department || "--"}</td>
                        <td>
                          {encounter.phase === "his_only" || encounter.status === "HIS_ONLY" ? (
                            <span className="status-chip patient-records-status-untracked">HIS ONLY</span>
                          ) : (
                            <span className={`status-chip ${getEncounterChipClass(encounter)}`}>
                              {encounter.phase_label || encounter.status}
                            </span>
                          )}
                        </td>
                        <td>{formatMinutes(encounter?.tat?.overall_tat_minutes)}</td>
                        <td>{formatMinutes(encounter?.tat?.consulting_tat_minutes)}</td>
                        <td>
                          <div className="patient-records-badge-row">
                            {getWorkflowBadges(encounter).map((label) => (
                              <span key={`${encounter.encounter_key}-${label}`} className="patient-records-badge">
                                {label}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>{encounter.consult_note ? "Available" : "--"}</td>
                        <td>
                          {encounter.token_id ? (
                            <Link
                              to={`/tokens/${encodeURIComponent(encounter.token_id)}`}
                              className="patient-records-link"
                              onClick={(event) => event.stopPropagation()}
                            >
                              Open token
                            </Link>
                          ) : (
                            <span className="patient-records-link patient-records-link-disabled">No token</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </article>

            <aside className="card patient-records-detail-card">
              {selectedEncounter ? (
                <>
                  <div className="patient-records-section-head">
                    <div>
                      <h3>Visit Detail</h3>
                      <p className="page-subtitle">
                        {selectedEncounter.visit_id || "Unknown visit"} {selectedEncounter.token_id ? `| ${selectedEncounter.token_id}` : ""}
                      </p>
                    </div>
                    {selectedEncounter.token_id ? (
                      <Link
                        to={`/tokens/${encodeURIComponent(selectedEncounter.token_id)}`}
                        className="patient-records-link"
                      >
                        Open token
                      </Link>
                    ) : null}
                  </div>

                  <div className="patient-records-badge-row patient-records-detail-badges">
                    <span className="patient-records-badge">{selectedEncounter.department || "Department unknown"}</span>
                    {selectedEncounter.type ? (
                      <span className="patient-records-badge">{selectedEncounter.type}</span>
                    ) : null}
                    {selectedEncounter.phase === "his_only" || selectedEncounter.status === "HIS_ONLY" ? (
                      <span className="status-chip patient-records-status-untracked">HIS ONLY</span>
                    ) : (
                      <span className={`status-chip ${getEncounterChipClass(selectedEncounter)}`}>
                        {selectedEncounter.phase_label || selectedEncounter.status}
                      </span>
                    )}
                  </div>

                  <div className="detail-stats patient-records-detail-stats">
                    <article className="card">
                      <h4>Overall TAT</h4>
                      <p className="detail-stat-metric">
                        {formatMinutes(selectedEncounter?.tat?.overall_tat_minutes)}
                      </p>
                    </article>
                    <article className="card">
                      <h4>Waiting</h4>
                      <p className="detail-stat-metric">
                        {formatMinutes(selectedEncounter?.tat?.waiting_tat_minutes)}
                      </p>
                    </article>
                    <article className="card">
                      <h4>Consult</h4>
                      <p className="detail-stat-metric">
                        {formatMinutes(selectedEncounter?.tat?.consulting_tat_minutes)}
                      </p>
                    </article>
                    <article className="card">
                      <h4>Billing</h4>
                      <p className="detail-stat-metric">
                        {formatMinutes(selectedEncounter?.tat?.billing_tat_minutes)}
                      </p>
                    </article>
                    <article className="card">
                      <h4>Lab</h4>
                      <p className="detail-stat-metric">
                        {formatMinutes(selectedEncounter?.tat?.lab_test_tat_minutes)}
                      </p>
                    </article>
                    <article className="card">
                      <h4>Treatment</h4>
                      <p className="detail-stat-metric">
                        {formatMinutes(selectedEncounter?.tat?.treatment_tat_minutes)}
                      </p>
                    </article>
                  </div>

                  <div className="patient-records-subsection">
                    <h4>Journey Timeline</h4>
                    <JourneyTimeline
                      tracked={selectedEncounter.journey_available}
                      loading={journeyState.loading}
                      error={journeyState.error}
                      steps={journeySteps}
                    />
                  </div>

                  <div className="patient-records-subsection">
                    <h4>Clinical Summary</h4>
                    <dl className="patient-records-kv">
                      <div>
                        <dt>Admission</dt>
                        <dd>{formatDateTime(selectedEncounter.admission || selectedEncounter.occurred_at)}</dd>
                      </div>
                      <div>
                        <dt>Referral</dt>
                        <dd>{selectedEncounter.referred_department || "--"}</dd>
                      </div>
                      <div>
                        <dt>Post-consult plans</dt>
                        <dd>
                          {selectedEncounter?.time_tracking?.post_consult_plans?.length
                            ? selectedEncounter.time_tracking.post_consult_plans.join(", ")
                            : "--"}
                        </dd>
                      </div>
                      <div>
                        <dt>Billing paid</dt>
                        <dd>{formatCurrency(selectedEncounter?.billing?.paid_amount ?? 0)}</dd>
                      </div>
                    </dl>
                    <div className="patient-records-note">
                      <strong>Consult note</strong>
                      <p>{selectedEncounter.consult_note || "No consult note captured for this encounter."}</p>
                    </div>
                  </div>

                  <div className="patient-records-subsection">
                    <h4>Key Timestamps</h4>
                    <dl className="patient-records-kv">
                      <div>
                        <dt>Waiting start</dt>
                        <dd>{formatDateTime(selectedEncounter?.time_tracking?.waiting_start)}</dd>
                      </div>
                      <div>
                        <dt>Consult start</dt>
                        <dd>{formatDateTime(selectedEncounter?.time_tracking?.consult_start)}</dd>
                      </div>
                      <div>
                        <dt>Consult end</dt>
                        <dd>{formatDateTime(selectedEncounter?.time_tracking?.consult_end)}</dd>
                      </div>
                      <div>
                        <dt>Billing start</dt>
                        <dd>{formatDateTime(selectedEncounter?.time_tracking?.billing_start)}</dd>
                      </div>
                      <div>
                        <dt>Lab start</dt>
                        <dd>{formatDateTime(selectedEncounter?.time_tracking?.lab_start)}</dd>
                      </div>
                      <div>
                        <dt>Treatment start</dt>
                        <dd>{formatDateTime(selectedEncounter?.time_tracking?.care_start)}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="patient-records-subsection">
                    <h4>Billing Payments</h4>
                    {!selectedEncounter?.time_tracking?.billing_payments?.length ? (
                      <p className="muted-inline">No billing payments recorded for this encounter.</p>
                    ) : (
                      <div className="patient-records-payment-list">
                        {selectedEncounter.time_tracking.billing_payments.map((payment) => (
                          <div key={payment.id} className="patient-records-payment-row">
                            <strong>{formatCurrency(payment.amount)}</strong>
                            <span>{payment.label || "General"}</span>
                            <span>{formatDateTime(payment.paid_at)}</span>
                            <span>{payment.note || "--"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <LogList title="Lab session" logs={selectedEncounter?.time_tracking?.lab_logs ?? []} />
                  <LogList
                    title="Pharmacy session"
                    logs={selectedEncounter?.time_tracking?.pharmacy_logs ?? []}
                  />
                  <LogList
                    title="Treatment session"
                    logs={selectedEncounter?.time_tracking?.treatment_logs ?? []}
                  />
                </>
              ) : (
                <p className="muted-inline">Select a visit row to inspect encounter details.</p>
              )}
            </aside>
          </section>
        </>
      ) : null}
    </section>
  );
};
