import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchTokenJourney } from "../services/journeyService";
import { fetchPatientRecord, searchPatientRecords } from "../services/patientRecordsService";
import { APP_NAME } from "../constants/brand.js";
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

const sourceLabel = (row = {}) => {
  const source = String(row?.source ?? "").toLowerCase();
  if (source === "both") {
    return `HIS + ${APP_NAME}`;
  }
  if (source === "lineloom") {
    return APP_NAME;
  }
  return "HIS";
};

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
    return <p className="muted-inline">No {APP_NAME} token timeline exists for this HIS-only visit.</p>;
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

const DetailKv = ({ items = [] }) => (
  <dl className="patient-records-kv">
    {items.map((item) => (
      <div key={item.label}>
        <dt>{item.label}</dt>
        <dd>{item.value ?? "--"}</dd>
      </div>
    ))}
  </dl>
);

const WorkflowLogTable = ({ title = "", columns = [], rows = [], emptyMessage = "No records." }) => (
  <div className="patient-records-subsection">
    <h4>{title}</h4>
    {!rows.length ? (
      <p className="muted-inline">{emptyMessage}</p>
    ) : (
      <div className="patient-records-data-table-wrap">
        <table className="patient-records-data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row._key ?? idx}>
                {columns.map((col) => (
                  <td key={col.key}>{row[col.key] ?? "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

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
          latest_source: sourceLabel(row),
          tracked: Boolean(row?.tracked),
          lineloom_matches: row?.tracked ? 1 : 0,
          match_count: current?.match_count ?? 0
        };
      }
      acc[patientId].match_count = (acc[patientId]?.match_count ?? 0) + 1;
      if (row?.tracked) {
        acc[patientId].lineloom_matches = (acc[patientId].lineloom_matches ?? 0) + 1;
        acc[patientId].tracked = true;
      }
      if (parseTime(row?.admission) >= parseTime(acc[patientId].latest_admission)) {
        acc[patientId].latest_source = sourceLabel(row);
      }
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
      const rows = await searchPatientRecords(filters);
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
  const mongoTokens = Array.isArray(record?.mongodb?.tokens) ? record.mongodb.tokens : [];
  const journeySteps = Array.isArray(journeyState.data?.timeline) ? journeyState.data.timeline : [];

  const selectedTracking = selectedEncounter?.time_tracking ?? {};
  const labTableRows = (selectedTracking.lab_logs ?? []).map((entry, idx) => ({
    _key: `lab-${entry.id ?? idx}`,
    num: idx + 1,
    req: entry.request_no || "—",
    procedure: entry.procedure || "—",
    dept: entry.dept || "—",
    status: entry.status || "—",
    request: formatDateTime(entry.request_at),
    sample: formatDateTime(entry.sample_received_at),
    completed: formatDateTime(entry.completed_at)
  }));
  const pharmacyTableRows = (selectedTracking.pharmacy_logs ?? []).map((entry, idx) => ({
    _key: `ph-${entry.id ?? idx}`,
    num: idx + 1,
    bill: entry.bill_no || "—",
    req: entry.request_no || "—",
    issue: entry.issue_type || "—",
    dept: entry.dept || "—",
    request: formatDateTime(entry.request_at),
    billTime: formatDateTime(entry.bill_at),
    completed: formatDateTime(entry.completed_at)
  }));
  const treatmentTableRows = (selectedTracking.treatment_logs ?? []).map((entry, idx) => ({
    _key: `tr-${entry.id ?? idx}`,
    num: idx + 1,
    start: formatDateTime(entry.start),
    end: formatDateTime(entry.end) || "In progress"
  }));

  return (
    <section className="page cc-page patient-records-page">
      <div className="page-header">
        <div>
          <h1>Patient Records</h1>
          <p className="page-subtitle">
            Search combines HIS admissions and {APP_NAME} tokens (MongoDB). Open a patient to see the merged record.
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
            <p className="page-subtitle">
              HIS = hospital visit only. {APP_NAME} = tracked in MongoDB. HIS + {APP_NAME} = both match.
            </p>
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
                  <th>Source</th>
                  <th>{APP_NAME}</th>
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
                    <td>
                      <span
                        className={`patient-records-badge ${
                          row.latest_source === `HIS + ${APP_NAME}`
                            ? "patient-records-badge--both"
                            : row.tracked
                              ? "patient-records-badge--lineloom"
                              : ""
                        }`}
                      >
                        {row.latest_source || "HIS"}
                      </span>
                    </td>
                    <td>{row.tracked ? `${row.lineloom_matches ?? 0} tracked` : "—"}</td>
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
                  {patient.phone || "No phone"} | {patient.sex || "Sex unknown"} | DOB{" "}
                  {formatDateOnly(patient.dob)}
                </p>
                <div className="patient-tags">
                  {patient.patient_reg_no ? (
                    <span>Master reg {patient.patient_reg_no}</span>
                  ) : null}
                  {patient.i_reg_no && patient.i_reg_no !== patient.patient_reg_no ? (
                    <span>iReg_No {patient.i_reg_no}</span>
                  ) : null}
                  {patient.mongodb_token_count != null ? (
                    <span>{patient.mongodb_token_count} MongoDB token(s)</span>
                  ) : null}
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

          <article className="card patient-records-mongo-card">
            <div className="patient-records-section-head">
              <div>
                <h3>{APP_NAME} patient record (MongoDB)</h3>
                <p className="page-subtitle">
                  Complete token and time-tracking data stored in MongoDB for this patient.
                </p>
              </div>
            </div>
            <DetailKv
              items={[
                { label: "Patient ID (iPat_id)", value: patient.patient_id },
                { label: "Master reg (iReg_No)", value: patient.patient_reg_no || patient.i_reg_no },
                { label: "Name", value: patient.name },
                { label: "Phone", value: patient.phone },
                { label: "Sex", value: patient.sex },
                { label: "DOB", value: formatDateOnly(patient.dob) },
                { label: "Latest visit", value: patient.latest_visit_id },
                { label: "Latest department", value: patient.latest_department },
                { label: "Latest status", value: patient.latest_status },
                { label: "Last seen", value: formatDateTime(patient.last_seen_at) },
                { label: "Tokens in MongoDB", value: String(patient.mongodb_token_count ?? mongoTokens.length) }
              ]}
            />
            {!mongoTokens.length ? (
              <p className="muted-inline" style={{ marginTop: 12 }}>
                No {APP_NAME} tokens exist in MongoDB for this patient yet. HIS-only visits appear in visit
                history below.
              </p>
            ) : (
              <div className="patient-records-data-table-wrap" style={{ marginTop: 16 }}>
                <table className="patient-records-data-table">
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>OP / IP reg</th>
                      <th>Master reg</th>
                      <th>Department</th>
                      <th>Queue #</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Workflow</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mongoTokens.map((row) => {
                      const tt = row.time_tracking ?? {};
                      const workflow = [
                        tt.consult_end ? "Consult" : null,
                        tt.pharmacy_logs?.length ? "Pharmacy" : null,
                        tt.lab_logs?.length ? "Lab" : null,
                        tt.billing_payments?.length ? "Billing" : null,
                        tt.treatment_logs?.length ? "Treatment" : null
                      ].filter(Boolean);
                      return (
                        <tr key={row.token_id}>
                          <td>
                            <strong>{row.token_id}</strong>
                          </td>
                          <td>{row.visit_id || "—"}</td>
                          <td>{row.patient_reg_no || "—"}</td>
                          <td>{row.department || "—"}</td>
                          <td>{row.department_queue_no ?? "—"}</td>
                          <td>{row.status || "—"}</td>
                          <td>
                            <small>{formatDateTime(row.created_at)}</small>
                          </td>
                          <td>{workflow.length ? workflow.join(", ") : "—"}</td>
                          <td>
                            <Link
                              to={`/tokens/${encodeURIComponent(row.token_id)}`}
                              className="patient-records-link"
                            >
                              Open token
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </article>

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

                  {selectedEncounter.token ? (
                    <div className="patient-records-subsection">
                      <h4>Token (MongoDB)</h4>
                      <DetailKv
                        items={[
                          { label: "Token ID", value: selectedEncounter.token.token_id },
                          { label: "Patient ID", value: selectedEncounter.token.patient_id },
                          { label: "Visit / OP reg", value: selectedEncounter.token.visit_id },
                          {
                            label: "Master reg",
                            value: selectedEncounter.token.patient_reg_no || "—"
                          },
                          { label: "Department", value: selectedEncounter.token.department },
                          {
                            label: "Queue #",
                            value:
                              selectedEncounter.token.department_queue_no != null
                                ? String(selectedEncounter.token.department_queue_no)
                                : "—"
                          },
                          { label: "Status", value: selectedEncounter.token.status },
                          { label: "Parent token", value: selectedEncounter.token.parent_token_id || "—" },
                          { label: "Created", value: formatDateTime(selectedEncounter.token.created_at) },
                          { label: "Updated", value: formatDateTime(selectedEncounter.token.updated_at) }
                        ]}
                      />
                    </div>
                  ) : null}

                  <div className="patient-records-subsection">
                    <h4>Clinical Summary</h4>
                    <DetailKv
                      items={[
                        {
                          label: "Admission",
                          value: formatDateTime(
                            selectedEncounter.admission || selectedEncounter.occurred_at
                          )
                        },
                        { label: "Referral", value: selectedEncounter.referred_department || "—" },
                        {
                          label: "Post-consult plans",
                          value: selectedTracking.post_consult_plans?.length
                            ? selectedTracking.post_consult_plans.join(", ")
                            : "—"
                        },
                        {
                          label: "Labs ordered",
                          value: selectedTracking.labs_ordered ? "Yes" : "No"
                        },
                        {
                          label: "Billing paid",
                          value: formatCurrency(selectedEncounter?.billing?.paid_amount ?? 0)
                        },
                        {
                          label: "Billing total",
                          value: formatCurrency(selectedTracking.billing_total_amount ?? 0)
                        }
                      ]}
                    />
                    <div className="patient-records-note">
                      <strong>Consult note</strong>
                      <p>{selectedEncounter.consult_note || "No consult note captured for this encounter."}</p>
                    </div>
                  </div>

                  <div className="patient-records-subsection">
                    <h4>Time tracking (MongoDB)</h4>
                    <DetailKv
                      items={[
                        { label: "Waiting start", value: formatDateTime(selectedTracking.waiting_start) },
                        { label: "Consult start", value: formatDateTime(selectedTracking.consult_start) },
                        { label: "Consult end", value: formatDateTime(selectedTracking.consult_end) },
                        { label: "Break start", value: formatDateTime(selectedTracking.break_start) },
                        { label: "Break end", value: formatDateTime(selectedTracking.break_end) },
                        { label: "Billing start", value: formatDateTime(selectedTracking.billing_start) },
                        { label: "Billing end", value: formatDateTime(selectedTracking.billing_end) },
                        {
                          label: "Billing elapsed",
                          value: selectedTracking.billing_elapsed_ms
                            ? `${Math.round(Number(selectedTracking.billing_elapsed_ms) / 1000)}s`
                            : "—"
                        },
                        { label: "Pharmacy start", value: formatDateTime(selectedTracking.pharmacy_start) },
                        { label: "Pharmacy end", value: formatDateTime(selectedTracking.pharmacy_end) },
                        {
                          label: "Pharmacy elapsed",
                          value: selectedTracking.pharmacy_elapsed_ms
                            ? `${Math.round(Number(selectedTracking.pharmacy_elapsed_ms) / 1000)}s`
                            : "—"
                        },
                        { label: "Lab start", value: formatDateTime(selectedTracking.lab_start) },
                        { label: "Lab end", value: formatDateTime(selectedTracking.lab_end) },
                        { label: "Treatment start", value: formatDateTime(selectedTracking.care_start) },
                        { label: "Treatment end", value: formatDateTime(selectedTracking.care_end) }
                      ]}
                    />
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

                  <WorkflowLogTable
                    title="Lab sessions (MongoDB)"
                    emptyMessage="No lab logs stored for this token."
                    columns={[
                      { key: "num", label: "#" },
                      { key: "req", label: "Req" },
                      { key: "procedure", label: "Procedure" },
                      { key: "dept", label: "Dept" },
                      { key: "status", label: "Status" },
                      { key: "request", label: "Request" },
                      { key: "sample", label: "Sample" },
                      { key: "completed", label: "Completed" }
                    ]}
                    rows={labTableRows}
                  />
                  <WorkflowLogTable
                    title="Pharmacy sessions (MongoDB)"
                    emptyMessage="No pharmacy logs stored for this token."
                    columns={[
                      { key: "num", label: "#" },
                      { key: "bill", label: "Bill #" },
                      { key: "req", label: "Req" },
                      { key: "issue", label: "Issue" },
                      { key: "dept", label: "Dept" },
                      { key: "request", label: "Request" },
                      { key: "billTime", label: "Bill time" },
                      { key: "completed", label: "Completed" }
                    ]}
                    rows={pharmacyTableRows}
                  />
                  <WorkflowLogTable
                    title="Treatment sessions (MongoDB)"
                    emptyMessage="No treatment logs stored for this token."
                    columns={[
                      { key: "num", label: "#" },
                      { key: "start", label: "Start" },
                      { key: "end", label: "End" }
                    ]}
                    rows={treatmentTableRows}
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
