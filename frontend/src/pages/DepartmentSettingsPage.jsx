import { useCallback, useEffect, useState } from "react";
import {
  createDepartmentRequest,
  deleteDepartmentRequest,
  fetchAllDepartments,
  updateDepartmentRequest
} from "../services/departmentService";

const emptyForm = {
  name: "",
  sort_order: 0,
  is_active: true,
  max_wait_minutes: "",
  max_queue_depth: "",
  max_lab_stuck_minutes: ""
};

export const DepartmentSettingsPage = () => {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await fetchAllDepartments();
      setRows(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError?.message ?? "Failed to load departments");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const startEdit = (row = {}) => {
    setEditingId(row._id ?? "");
    const rules = row.alert_rules ?? {};
    setForm({
      name: row.name ?? "",
      sort_order: row.sort_order ?? 0,
      is_active: row.is_active !== false,
      max_wait_minutes: rules.max_wait_minutes ?? "",
      max_queue_depth: rules.max_queue_depth ?? "",
      max_lab_stuck_minutes: rules.max_lab_stuck_minutes ?? ""
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = String(form.name ?? "").trim();
    if (!name) {
      setError("Name is required");
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      const alert_rules = {
        max_wait_minutes: form.max_wait_minutes === "" ? null : Number(form.max_wait_minutes),
        max_queue_depth: form.max_queue_depth === "" ? null : Number(form.max_queue_depth),
        max_lab_stuck_minutes:
          form.max_lab_stuck_minutes === "" ? null : Number(form.max_lab_stuck_minutes)
      };
      if (editingId) {
        await updateDepartmentRequest(editingId, {
          name,
          sort_order: Number(form.sort_order) || 0,
          is_active: Boolean(form.is_active),
          alert_rules
        });
      } else {
        await createDepartmentRequest({
          name,
          sort_order: Number(form.sort_order) || 0,
          is_active: form.is_active !== false,
          alert_rules
        });
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (saveError) {
      setError(saveError?.message ?? "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id = "") => {
    if (!window.confirm("Delete this department? Tokens must not depend on it.")) {
      return;
    }
    setError("");
    try {
      await deleteDepartmentRequest(id);
      await load();
    } catch (deleteError) {
      setError(deleteError?.message ?? "Delete failed");
    }
  };

  return (
    <section className="page department-settings-page">
      <h2>Department configuration</h2>
      <p className="live-queue-lead">
        Manage departments used when creating tokens and when starting consultation. Inactive
        departments are hidden from dropdowns.
      </p>

      {error ? <p className="error-text">{error}</p> : null}

      <article className="card">
        <h3>{editingId ? "Edit department" : "Add department"}</h3>
        <form className="department-settings-form" onSubmit={handleSubmit}>
          <label htmlFor="dept_name">Name</label>
          <input
            id="dept_name"
            value={form.name}
            onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
            required
            placeholder="e.g. Cardiology"
          />
          <label htmlFor="dept_order">Sort order</label>
          <input
            id="dept_order"
            type="number"
            value={form.sort_order}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, sort_order: event.target.value }))
            }
          />
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, is_active: event.target.checked }))
              }
            />
            Active (shown in lists)
          </label>
          <h4 className="rules-heading">Alert rules (optional)</h4>
          <p className="live-queue-lead">
            When set, the API evaluates the live queue and raises alerts (see Alerts page). Leave blank to
            disable that check.
          </p>
          <label htmlFor="rule_wait">Max wait (minutes)</label>
          <input
            id="rule_wait"
            type="number"
            min="0"
            placeholder="e.g. 45"
            value={form.max_wait_minutes}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, max_wait_minutes: event.target.value }))
            }
          />
          <label htmlFor="rule_depth">Max queue depth (active tokens)</label>
          <input
            id="rule_depth"
            type="number"
            min="0"
            placeholder="e.g. 12"
            value={form.max_queue_depth}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, max_queue_depth: event.target.value }))
            }
          />
          <label htmlFor="rule_lab">Max lab testing duration (minutes)</label>
          <input
            id="rule_lab"
            type="number"
            min="0"
            placeholder="e.g. 30"
            value={form.max_lab_stuck_minutes}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, max_lab_stuck_minutes: event.target.value }))
            }
          />
          <div className="department-settings-actions">
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : editingId ? "Update" : "Create"}
            </button>
            {editingId ? (
              <button type="button" className="btn-secondary" onClick={startCreate}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      </article>

      {isLoading ? <p>Loading…</p> : null}

      {!isLoading ? (
        <article className="card table-card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Sort</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id}>
                  <td>{row.name}</td>
                  <td>{row.sort_order ?? 0}</td>
                  <td>{row.is_active ? "Yes" : "No"}</td>
                  <td>
                    <div className="action-group">
                      <button type="button" onClick={() => startEdit(row)}>
                        Edit
                      </button>
                      <button type="button" onClick={() => handleDelete(row._id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? <p className="muted">No departments yet.</p> : null}
        </article>
      ) : null}
    </section>
  );
};
