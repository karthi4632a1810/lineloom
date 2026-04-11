import mongoose from "mongoose";

const timeTrackingSchema = new mongoose.Schema(
  {
    token_id: { type: String, required: true, unique: true, index: true },
    waiting_start: { type: Date, default: null },
    consult_start: { type: Date, default: null },
    consult_end: { type: Date, default: null },
    care_start: { type: Date, default: null },
    care_end: { type: Date, default: null },
    /** When consult orders labs/tests: billing timer starts at consult end; patient pays before lab. */
    billing_start: { type: Date, default: null },
    billing_end: { type: Date, default: null },
    /** Lab queue after payment until lab work begins; then lab testing until lab_end. */
    lab_start: { type: Date, default: null },
    lab_end: { type: Date, default: null },
    consult_note: { type: String, default: "" },
    referred_department: { type: String, default: "" },
    break_start: { type: Date, default: null },
    break_end: { type: Date, default: null }
  },
  { timestamps: true, collection: "time_tracking" }
);

export const TimeTracking = mongoose.model("TimeTracking", timeTrackingSchema);
