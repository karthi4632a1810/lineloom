import { useEffect, useRef, useState } from "react";
import { fetchActiveDepartments } from "../services/departmentService";
import { searchHisPatients } from "../services/hisService";
import { createTokenRequest } from "../services/tokenService";

const initialForm = { patient_id: "", visit_id: "", department: "" };

export const TokenCreationPage = () => {
  const [name, setName] = useState("");
  const [regNo, setRegNo] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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
    fetchActiveDepartments()
      .then((list) => setDepartmentCatalog(Array.isArray(list) ? list : []))
      .catch(() => setDepartmentCatalog([]));
  }, []);

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
    const names = departmentCatalog.map((d) => d.name);
    const initialDept = names.includes(suggested) ? suggested : "";
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
      const token = await createTokenRequest(form);
      setCreatedToken(token);
      setForm(initialForm);
      setSelectedPatient(null);
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
        {!results.length ? (
          <p className="muted-hint">No results yet. Set filters above and click Search.</p>
        ) : null}
        {results.length > 0 ? (
          <div className="token-search-table-wrap">
            <table className="token-search-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>IP / OP Reg No</th>
                  <th>Admission</th>
                  <th>IP Active</th>
                  <th>iReg_No</th>
                  <th>cPat_Name</th>
                  <th>dDob</th>
                  <th>cSex</th>
                  <th>iUser_id</th>
                  <th>User Name</th>
                  <th>Dept ID</th>
                  <th>Dept Name</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {results.map((patient) => (
                  <tr key={`${patient.type ?? "?"}-${patient.patient_id}-${patient.visit_id}`}>
                    <td>
                      <span className="visit-type-pill" data-type={patient.type ?? ""}>
                        {patient.type === "IP" ? "IP" : "OP"}
                      </span>
                    </td>
                    <td>{patient.reg_no ?? patient.visit_id ?? "-"}</td>
                    <td>{patient.admission ?? "-"}</td>
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
                    <td>{patient.i_user_name ?? "-"}</td>
                    <td>{patient.dept_id ?? patient.department ?? "-"}</td>
                    <td>{patient.dept_name ?? "-"}</td>
                    <td>
                      <button type="button" onClick={() => handleOpenCreateModal(patient)}>
                        Create Token
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>

      {selectedPatient ? (
        <section className="modal-overlay">
          <article className="modal-card token-modal">
            <div className="token-modal-header">
              <h3>Create Token</h3>
              <span className="visit-type-pill" data-type={selectedPatient?.type ?? ""}>
                {selectedPatient?.type === "IP" ? "IP" : "OP"}
              </span>
            </div>
            <form className="token-modal-form" onSubmit={handleSubmit}>
              <div className="token-modal-grid">
                <label htmlFor="patient_id">Patient ID</label>
                <input id="patient_id" name="patient_id" value={form.patient_id} readOnly />
                <label htmlFor="name">Name</label>
                <input id="name" value={selectedPatient?.name ?? ""} readOnly />
                <label htmlFor="visit_id">Reg no (OP/IP)</label>
                <input id="visit_id" name="visit_id" value={form.visit_id} readOnly />
                <label htmlFor="department">Department</label>
                <select
                  id="department"
                  name="department"
                  value={form.department}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select department</option>
                  {departmentCatalog.map((dept) => (
                    <option key={dept._id ?? dept.name} value={dept.name}>
                      {dept.name}
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
