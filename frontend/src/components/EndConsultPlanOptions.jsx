import { POST_CONSULT_OPTIONS } from "../constants/postConsultOptions";

const VALID_PLAN_IDS = new Set(POST_CONSULT_OPTIONS.map((o) => o.id));

/**
 * @param {string[]|string} selected - checked plan ids, or a single id (legacy)
 */
export const buildEndConsultPlans = (selected = []) => {
  const raw = Array.isArray(selected) ? selected : selected ? [selected] : [];
  return [
    ...new Set(
      raw
        .map((id) => String(id ?? "").trim())
        .filter((id) => VALID_PLAN_IDS.has(id))
    )
  ];
};

/**
 * After consult: select any follow-up paths (not mutually exclusive).
 */
export const EndConsultPlanOptions = ({ selectedIds = [], onSelectedChange }) => {
  const list = Array.isArray(selectedIds) ? selectedIds : [];
  const toggle = (id) => {
    const set = new Set(list);
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    onSelectedChange([...set]);
  };

  return (
    <div className="end-consult-wizard">
      <fieldset className="end-consult-plans">
        <legend className="end-consult-plans-legend">What is planned right now (not a final commitment)</legend>
        {POST_CONSULT_OPTIONS.map((opt) => (
          <label key={opt.id} className="end-consult-plan-item">
            <input
              type="checkbox"
              checked={list.includes(opt.id)}
              onChange={() => toggle(opt.id)}
            />
            <span className="end-consult-plan-text">
              <span className="end-consult-plan-title">{opt.label}</span>
              {opt.hint ? <small className="end-consult-plan-hint">{opt.hint}</small> : null}
            </span>
          </label>
        ))}
        <p className="end-consult-wizard-hint">
          Pharmacy first, labs undecided: select only Pharmacy / buy medicine (and Billing / payment
          if that is the next step). Do not select Lab tests until you are actually ordering tests.
          If you add labs later, open the token and use Order lab tests.
        </p>
        <p className="end-consult-wizard-hint end-consult-wizard-hint-secondary">
          Pharmacy and labs both known now: select Pharmacy and Lab tests. Leave boxes empty if you
          are not tagging a next step.
        </p>
      </fieldset>
    </div>
  );
};
