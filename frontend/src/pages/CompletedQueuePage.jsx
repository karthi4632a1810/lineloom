import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchCompletedQueue } from "../services/tokenService";

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

const normalizeTokenId = (value = "") => String(value ?? "").replace(/^\/+|\/+$/g, "");

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
    <section className="page live-queue-page">
      <h2>Completed Tokens</h2>
      <p className="live-queue-lead">Shows only completed tokens from MongoDB.</p>

      <form className="card filter-grid live-queue-filters" onSubmit={handleApplySearch}>
        <input
          type="search"
          name="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Name, phone, reg no, OP/IP visit no, token id…"
          className="live-queue-search"
        />
        <button type="submit">Search</button>
      </form>

      {error ? <p className="error-text">{error}</p> : null}
      {isLoading ? <p>Loading completed tokens…</p> : null}

      {!isLoading && !error && !visibleRows.length ? <p>No completed tokens found.</p> : null}

      {!isLoading && visibleRows.length ? (
        <article className="card table-card">
          <table>
            <thead>
              <tr>
                <th className="col-token-no">Token #</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Department</th>
                <th className="col-tat">Waiting TAT</th>
                <th className="col-tat">Consult TAT</th>
                <th className="col-tat">Treatment TAT</th>
                <th className="col-tat">Overall TAT</th>
                <th>Completed At</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, queueIndex) => (
                <tr
                  key={row.token_id}
                  className="clickable-row"
                  onClick={() => {
                    const cleanId = normalizeTokenId(row.token_id);
                    if (!cleanId) {
                      return;
                    }
                    navigate(`/tokens/${cleanId}`);
                  }}
                >
                  <td className="col-token-no">
                    <span className="token-queue-no">#{queueIndex + 1}</span>
                    <span className="token-queue-id" title={row.token_id}>
                      {row.token_id}
                    </span>
                  </td>
                  <td>{row.name}</td>
                  <td>{row.phone || "—"}</td>
                  <td>{row.department}</td>
                  <td className="col-tat">{formatSeconds(toSecondsFromMinutes(row.waiting_tat_minutes))}</td>
                  <td className="col-tat">{formatSeconds(toSecondsFromMinutes(row.consulting_tat_minutes))}</td>
                  <td className="col-tat">{formatSeconds(toSecondsFromMinutes(row.treatment_tat_minutes))}</td>
                  <td className="col-tat">{formatSeconds(toSecondsFromMinutes(row.overall_tat_minutes))}</td>
                  <td>{formatDateTime(row.treatment_end)}</td>
                  <td>
                    <span className="status-chip status-completed">COMPLETED</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ) : null}
    </section>
  );
};

