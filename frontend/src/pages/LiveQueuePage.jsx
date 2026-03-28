import { useState } from "react";
import { Link } from "react-router-dom";
import { useAsyncData } from "../hooks/useAsyncData";
import {
  branchTokenRequest,
  endCareRequest,
  endConsultRequest,
  fetchLiveQueue,
  startCareRequest,
  startConsultRequest,
  startWaitingRequest
} from "../services/tokenService";

const actions = {
  waiting: startWaitingRequest,
  consultStart: startConsultRequest,
  consultEnd: endConsultRequest,
  careStart: startCareRequest,
  careEnd: endCareRequest
};

export const LiveQueuePage = () => {
  const { data, isLoading, error, reload } = useAsyncData(fetchLiveQueue, []);
  const [branchDepartment, setBranchDepartment] = useState("ENT");
  const [requestError, setRequestError] = useState("");

  const tokens = data ?? [];

  const handleAction = async (tokenId = "", actionKey = "") => {
    setRequestError("");
    try {
      const action = actions[actionKey];
      if (!action) {
        return;
      }
      await action(tokenId);
      await reload();
    } catch (actionError) {
      setRequestError(actionError?.message ?? "Action failed");
    }
  };

  const handleBranch = async (tokenId = "") => {
    setRequestError("");
    try {
      await branchTokenRequest(tokenId, { new_department: branchDepartment });
      await reload();
    } catch (branchError) {
      setRequestError(branchError?.message ?? "Branch action failed");
    }
  };

  if (isLoading) {
    return <section className="page">Loading live queue...</section>;
  }
  if (error) {
    return (
      <section className="page">
        <p className="error-text">{error}</p>
        <button type="button" onClick={reload}>
          Retry
        </button>
      </section>
    );
  }

  return (
    <section className="page">
      <h2>Live Queue</h2>
      {requestError ? <p className="error-text">{requestError}</p> : null}
      {!tokens.length ? <p>No active tokens in queue.</p> : null}
      {tokens.map((token) => (
        <article key={token.token_id} className="card">
          <h4>{token.token_id}</h4>
          <p>
            {token.patient_id} / {token.visit_id}
          </p>
          <p>{token.department}</p>
          <div className="action-group">
            <button type="button" onClick={() => handleAction(token.token_id, "waiting")}>
              Start Waiting
            </button>
            <button type="button" onClick={() => handleAction(token.token_id, "consultStart")}>
              Start Consult
            </button>
            <button type="button" onClick={() => handleAction(token.token_id, "consultEnd")}>
              End Consult
            </button>
            <button type="button" onClick={() => handleAction(token.token_id, "careStart")}>
              Start Care
            </button>
            <button type="button" onClick={() => handleAction(token.token_id, "careEnd")}>
              End Care
            </button>
          </div>
          <div className="action-group">
            <input
              value={branchDepartment}
              onChange={(event) => setBranchDepartment(event.target.value)}
              placeholder="New department"
            />
            <button type="button" onClick={() => handleBranch(token.token_id)}>
              Branch Token
            </button>
            <Link to={`/tokens/${token.token_id}`}>View Detail</Link>
          </div>
        </article>
      ))}
    </section>
  );
};
