import mongoose from "mongoose";

const alertRulesSchema = new mongoose.Schema(
  {
    max_wait_minutes: { type: Number, default: null },
    max_queue_depth: { type: Number, default: null },
    max_lab_stuck_minutes: { type: Number, default: null }
  },
  { _id: false }
);

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    sort_order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
    alert_rules: { type: alertRulesSchema, default: () => ({}) }
  },
  { timestamps: true, collection: "departments" }
);

departmentSchema.index({ is_active: 1, sort_order: 1, name: 1 });

export const Department = mongoose.model("Department", departmentSchema);
