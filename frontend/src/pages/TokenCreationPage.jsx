import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchHisDepartments } from "../services/dashboardService";
import { searchHisPatients } from "../services/hisService";
import { createTokenRequest } from "../services/tokenService";

const initialForm = { patient_id: "", visit_id: "", department: "" };

/** Local calendar date as YYYY-MM-DD for `<input type="date" />`. */
const getTodayDateInputValue = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatDateTime12h = (value = "") => {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "-";
  }
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
};

export const TokenCreationPage = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [regNo, setRegNo] = useState("");
  const [dateFrom, setDateFrom] = useState(() => getTodayDateInputValue());
  const [dateTo, setDateTo] = useState(() => getTodayDateInputValue());
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [sexFilter, setSexFilter] = useState("ALL");
  const [ipActiveFilter, setIpActiveFilter] = useState("ALL");
  const [results, setResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [createdToken, setCreatedToken] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [departmentCatalog, setDepartmentCatalog] = useState([]);
  const requestCounterRef = useRef(0);

  useEffect(() => {
    fetchHisDepartments()
      .then((list) => setDepartmentCatalog(Array.isArray(list) ? list : []))
      .catch(() => setDepartmentCatalog([]));
  }, []);

  const createTokenDepartments = useMemo(
    () =>
      [
        ...new Set(
          departmentCatalog
            .map((d) => String(d?.dept_name ?? d?.department ?? d?.name ?? "").trim())
            .filter(Boolean)
        )
      ].sort((a, b) => a.localeCompare(b)),
    [departmentCatalog]
  );

  const deptOptions = useMemo(() => {
    const values = [...new Set(results.map((row) => String(row?.dept_name ?? "").trim()).filter(Boolean))];
    return values.sort((a, b) => a.localeCompare(b));
  }, [results]);

  const sexOptions = useMemo(() => {
    return [...new Set(results.map((row) => String(row?.c_sex ?? "").trim().toUpperCase()).filter(Boolean))];
  }, [results]);

  const ipActiveOptions = useMemo(() => {
    return [
      ...new Set(
        results
          .map((row) => String(row?.ip_active ?? "").trim())
          .filter((value) => value !== "")
      )
    ];
  }, [results]);

  const filteredResults = useMemo(() => {
    return results.filter((row) => {
      const rowType = String(row?.type ?? "").toUpperCase();
      const rowDept = String(row?.dept_name ?? "").trim();
      const rowSex = String(row?.c_sex ?? "").trim().toUpperCase();
      const rowIpActive = String(row?.ip_active ?? "").trim();

      const matchesType = typeFilter === "ALL" || rowType === typeFilter;
      const matchesDept = deptFilter === "ALL" || rowDept === deptFilter;
      const matchesSex = sexFilter === "ALL" || rowSex === sexFilter;
      const matchesIpActive = ipActiveFilter === "ALL" || rowIpActive === ipActiveFilter;

      return matchesType && matchesDept && matchesSex && matchesIpActive;
    });
  }, [results, typeFilter, deptFilter, sexFilter, ipActiveFilter]);

  const performSearch = async () => {
    const n = String(name ?? "").trim();
    const r = String(regNo ?? "").trim();
    const df = String(dateFrom ?? "").trim();
    const dt = String(dateTo ?? "").trim();

    if (!n && !r && !df && !dt) {
      setError("Enter patient name, IP/OP reg no, and/or an admission date range, then click Search.");
      setResults([]);
      return;
    }

    const requestId = requestCounterRef.current + 1;
    requestCounterRef.current = requestId;
    setError("");
    setIsSearching(true);
    try {
      const rows = await searchHisPatients({
        name: n,
        reg_no: r,
        date_from: df,
        date_to: dt
      });
      if (requestCounterRef.current !== requestId) {
        return;
      }
      setResults(rows ?? []);
    } catch (requestError) {
      if (requestCounterRef.current !== requestId) {
        return;
      }
      setError(requestError?.message ?? "Unable to search patients");
    } finally {
      if (requestCounterRef.current === requestId) {
        setIsSearching(false);
      }
    }
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    await performSearch();
  };

  const handleOpenCreateModal = (patient = null) => {
    setSelectedPatient(patient);
    const suggested = String(patient?.department ?? "").trim();
    const initialDept = createTokenDepartments.includes(suggested) ? suggested : "";
    setForm({
      patient_id: patient?.patient_id ?? "",
      visit_id: patient?.visit_id ?? "",
      department: initialDept
    });
    setCreatedToken(null);
  };

  const handleChange = (event) => {
    const { name: field, value } = event.target;
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setCreatedToken(null);
    setIsSubmitting(true);
    try {
      const payload = {
        ...form,
        patient_name: String(selectedPatient?.c_pat_name ?? selectedPatient?.name ?? "").trim(),
        patient_phone: String(selectedPatient?.phone ?? "").trim()
      };
      const token = await createTokenRequest(payload);
      setCreatedToken(token);
      setForm(initialForm);
      setSelectedPatient(null);
      navigate("/live-queue");
    } catch (requestError) {
      setError(requestError?.message ?? "Unable to create token");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page token-create-page">
      <h2>Create Token</h2>
      <form className="card token-search-card token-search-filters" onSubmit={handleSearch}>
        <div className="token-search-fields">
          <label className="token-search-field">
            <span>Patient name</span>
            <input
              type="text"
              name="patient_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contains match"
              autoComplete="off"
            />
          </label>
          <label className="token-search-field">
            <span>IP / OP reg no / iReg_No</span>
            <input
              type="text"
              name="reg_no"
              value={regNo}
              onChange={(e) => setRegNo(e.target.value)}
              placeholder="e.g. IP07004303 or 6028045"
              autoComplete="off"
            />
          </label>
          <label className="token-search-field">
            <span>Admission from</span>
            <input
              type="date"
              name="date_from"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label className="token-search-field">
            <span>Admission to</span>
            <input
              type="date"
              name="date_to"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
        </div>
        <div className="token-search-actions">
          <button type="submit" disabled={isSearching}>
            {isSearching ? "Searching..." : "Search"}
          </button>
        </div>
      </form>
      {error ? <p className="error-text">{error}</p> : null}

      <article className="card token-search-results-card">
        <div className="token-search-table-wrap">
          <table className="token-search-table">
            <thead>
              <tr>
                  <th>SI No</th>
                  <th>
                    <div className="token-type-filter-head">
                      <select
                        name="type_filter"
                        value={typeFilter}
                        onChange={(event) => setTypeFilter(event.target.value)}
                        aria-label="Filter by type"
                      >
                        <option value="ALL">Type</option>
                        <option value="OP">OP</option>
                        <option value="IP">IP</option>
                      </select>
                    </div>
                  </th>
                  <th>IP / OP Reg No</th>
                  <th>Admission</th>
                  <th>
                    <div className="token-type-filter-head">
                      <select
                        name="ip_active_filter"
                        value={ipActiveFilter}
                        onChange={(event) => setIpActiveFilter(event.target.value)}
                        aria-label="Filter by IP Active"
                      >
                        <option value="ALL">IP Active</option>
                        {ipActiveOptions.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th>iReg_No</th>
                  <th>cPat_Name</th>
                  <th>dDob</th>
                  <th>
                    <div className="token-type-filter-head">
                      <select
                        name="sex_filter"
                        value={sexFilter}
                        onChange={(event) => setSexFilter(event.target.value)}
                        aria-label="Filter by cSex"
                      >
                        <option value="ALL">cSex</option>
                        {sexOptions.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th>iUser_id</th>
                  {/* <th>User Name</th> */}
                  <th>Dept ID</th>
                  <th>
                    <div className="token-type-filter-head">
                      <select
                        name="dept_filter"
                        value={deptFilter}
                        onChange={(event) => setDeptFilter(event.target.value)}
                        aria-label="Filter by Dept Name"
                      >
                        <option value="ALL">Dept Name</option>
                        {deptOptions.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.length ? (
                filteredResults.map((patient, index) => (
                  <tr key={`${patient.type ?? "?"}-${patient.patient_id}-${patient.visit_id}`}>
                    <td>{index + 1}</td>
                    <td>
                      <span className="visit-type-pill" data-type={patient.type ?? ""}>
                        {patient.type === "IP" ? "IP" : "OP"}
                      </span>
                    </td>
                    <td>{patient.reg_no ?? patient.visit_id ?? "-"}</td>
                    <td>{formatDateTime12h(patient.admission)}</td>
                    <td>
                      {patient.type === "IP"
                        ? patient.ip_active !== undefined && patient.ip_active !== ""
                          ? patient.ip_active
                          : "—"
                        : "—"}
                    </td>
                    <td>{patient.i_reg_no ?? "-"}</td>
                    <td>{patient.c_pat_name ?? patient.name ?? "-"}</td>
                    <td>{patient.d_dob ?? "-"}</td>
                    <td>{patient.c_sex ?? "-"}</td>
                    <td>{patient.i_user_id ?? "-"}</td>
                    {/* <td>{patient.i_user_name ?? "-"}</td> */}
                    <td>{patient.dept_id ?? patient.department ?? "-"}</td>
                    <td>{patient.dept_name ?? "-"}</td>
                    <td>
                      <button type="button" onClick={() => handleOpenCreateModal(patient)}>
                        Create Token
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={13} className="muted-hint">
                    No matching patients for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {selectedPatient ? (
        <section className="modal-overlay">
          <article className="modal-card token-modal">
            <div className="token-modal-header">
              <div>
                <h3>Create Token</h3>
                <p className="token-modal-subtitle">Patient details are auto-filled from HIS.</p>
              </div>
              <span className="visit-type-pill" data-type={selectedPatient?.type ?? ""}>
                {selectedPatient?.type === "IP" ? "IP" : "OP"}
              </span>
            </div>
            <form className="token-modal-form" onSubmit={handleSubmit}>
              <div className="token-modal-grid token-modal-readonly-grid">
                <label htmlFor="patient_id">Patient ID</label>
                <input
                  id="patient_id"
                  name="patient_id"
                  value={form.patient_id}
                  readOnly
                  aria-readonly="true"
                  className="token-readonly-input"
                />
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  value={selectedPatient?.name ?? ""}
                  readOnly
                  aria-readonly="true"
                  className="token-readonly-input"
                />
                <label htmlFor="visit_id">Reg no (OP/IP)</label>
                <input
                  id="visit_id"
                  name="visit_id"
                  value={form.visit_id}
                  readOnly
                  aria-readonly="true"
                  className="token-readonly-input"
                />
              </div>
              <div className="token-modal-grid">
                <label htmlFor="department">Department</label>
                <select
                  id="department"
                  name="department"
                  value={form.department}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select department</option>
                  {createTokenDepartments.map((departmentName) => (
                    <option key={departmentName} value={departmentName}>
                      {departmentName}
                    </option>
                  ))}
                </select>
              </div>
              <p className="muted small token-modal-note">
                Visit type: {selectedPatient?.type === "IP" ? "Inpatient (IP)" : "Outpatient (OP)"}
              </p>
              <div className="token-modal-actions">
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating token..." : "Create Token"}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setSelectedPatient(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </article>
        </section>
      ) : null}

      {createdToken ? (
        <article className="card">
          <h4>Token Created Successfully</h4>
          <p>Token ID: {createdToken.token_id}</p>
          <p>Status: {createdToken.status}</p>
          <p>Department: {createdToken.department}</p>
        </article>
      ) : null}
    </section>
  );
};
