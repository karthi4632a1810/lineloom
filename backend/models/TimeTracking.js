import mongoose from "mongoose";

const timeTrackingSchema = new mongoose.Schema(
  {
    token_id: { type: String, required: true, unique: true, index: true },
    waiting_start: { type: Date, default: null },
    consult_start: { type: Date, default: null },
    consult_end: { type: Date, default: null },
    /** Set when consult ends with labs/tests ordered; drives lab queue in journey (independent of billing). */
    labs_ordered: { type: Boolean, default: false },
    /** After end consult: ordered plan ids e.g. labs, treatment, pharmacy, billing (see tokenService). */
    post_consult_plans: { type: [String], default: [] },
    care_start: { type: Date, default: null },
    care_end: { type: Date, default: null },
    /** Auto-started at end consult when post_consult_plans include labs or pharmacy (payment path). */
    billing_start: { type: Date, default: null },
    billing_end: { type: Date, default: null },
    billing_elapsed_ms: { type: Number, default: 0, min: 0 },
    billing_total_amount: { type: Number, default: 0, min: 0 },
    billing_paid_amount: { type: Number, default: 0, min: 0 },
    billing_payments: [
      {
        amount: { type: Number, required: true, min: 0.01 },
        paid_at: { type: Date, default: Date.now },
        note: { type: String, default: "" },
        label: { type: String, default: "" }
      }
    ],
    /** Lab queue after payment until lab work begins; then lab testing until lab_end. */
    lab_start: { type: Date, default: null },
    lab_end: { type: Date, default: null },
    lab_logs: [
      {
        start: { type: Date, required: true },
        end: { type: Date, default: null }
      }
    ],
    /** Pharmacy desk timing; may be started/stopped multiple times until pharmacy_end. */
    pharmacy_start: { type: Date, default: null },
    pharmacy_end: { type: Date, default: null },
    pharmacy_elapsed_ms: { type: Number, default: 0, min: 0 },
    pharmacy_logs: [
      {
        start: { type: Date, required: true },
        end: { type: Date, default: null }
      }
    ],
    treatment_logs: [
      {
        start: { type: Date, required: true },
        end: { type: Date, default: null }
      }
    ],
    consult_note: { type: String, default: "" },
    referred_department: { type: String, default: "" },
    break_start: { type: Date, default: null },
    break_end: { type: Date, default: null }
  },
  { timestamps: true, collection: "time_tracking" }
);

export const TimeTracking = mongoose.model("TimeTracking", timeTrackingSchema);
