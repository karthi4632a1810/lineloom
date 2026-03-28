import { useEffect, useRef, useState } from "react";
import { searchHisPatients } from "../services/hisService";
import { createTokenRequest } from "../services/tokenService";

const initialForm = { patient_id: "", visit_id: "", department: "" };

export const TokenCreationPage = () => {
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [createdToken, setCreatedToken] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const requestCounterRef = useRef(0);

  const performSearch = async (value = "") => {
    const normalized = String(value ?? "").trim();
    if (!normalized) {
      setResults([]);
      return;
    }
    const requestId = requestCounterRef.current + 1;
    requestCounterRef.current = requestId;
    setError("");
    setIsSearching(true);
    try {
      const rows = await searchHisPatients(normalized);
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

  useEffect(() => {
    const query = String(searchText ?? "").trim();
    if (!query) {
      setResults([]);
      setError("");
      setIsSearching(false);
      return undefined;
    }
    const timer = setTimeout(() => {
      performSearch(query);
    }, 450);
    return () => {
      clearTimeout(timer);
    };
  }, [searchText]);

  const handleSearch = async (event) => {
    event.preventDefault();
    await performSearch(searchText);
  };

  const handleOpenCreateModal = (patient = null) => {
    setSelectedPatient(patient);
    setForm({
      patient_id: patient?.patient_id ?? "",
      visit_id: patient?.visit_id ?? "",
      department: patient?.department ?? ""
    });
    setCreatedToken(null);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
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
    <section className="page">
      <h2>Create Token</h2>
      <form className="card token-search-card" onSubmit={handleSearch}>
        <input
          id="search_text"
          name="search_text"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search OP/IP by patient id, name, visit id"
        />
        <button type="submit" disabled={isSearching}>
          {isSearching ? "Searching..." : "Search Patient"}
        </button>
      </form>
      {error ? <p className="error-text">{error}</p> : null}

      <article className="card">
        {!results.length ? <p>No patient rows yet. Search to begin.</p> : null}
        {results.map((patient) => (
          <div key={`${patient.patient_id}-${patient.visit_id}`} className="patient-row">
            <div>
              <strong>{patient.name}</strong>
              <p>
                Patient ID: {patient.patient_id} | Visit: {patient.visit_id} | Phone:{" "}
                {patient.phone || "-"}
              </p>
            </div>
            <button type="button" onClick={() => handleOpenCreateModal(patient)}>
              Create Token
            </button>
          </div>
        ))}
      </article>

      {selectedPatient ? (
        <section className="modal-overlay">
          <article className="modal-card">
            <h3>Create Token</h3>
            <form onSubmit={handleSubmit}>
              <label htmlFor="patient_id">Patient ID</label>
              <input id="patient_id" name="patient_id" value={form.patient_id} readOnly />
              <label htmlFor="name">Name</label>
              <input id="name" value={selectedPatient?.name ?? ""} readOnly />
              <label htmlFor="visit_id">Visit ID</label>
              <input id="visit_id" name="visit_id" value={form.visit_id} readOnly />
              <label htmlFor="department">Department</label>
              <input
                id="department"
                name="department"
                value={form.department}
                onChange={handleChange}
                required
              />
              <div className="action-group">
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating token..." : "Create Token"}
                </button>
                <button type="button" onClick={() => setSelectedPatient(null)}>
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
