import mongoose from "mongoose";

/** Logs staff-acknowledged operational actions for the intelligence feedback loop (Phase 4). */
const operationalActionSchema = new mongoose.Schema(
  {
    department: { type: String, default: "", trim: true },
    summary: { type: String, required: true, trim: true },
    action_type: { type: String, default: "manual", trim: true },
    source: { type: String, default: "ui", trim: true },
    related_alert_id: { type: mongoose.Schema.Types.ObjectId, ref: "AlertEvent", default: null },
    recorded_by: { type: String, default: "" },
    outcome_notes: { type: String, default: "" }
  },
  { timestamps: true, collection: "operational_actions" }
);

export const OperationalAction = mongoose.model("OperationalAction", operationalActionSchema);
