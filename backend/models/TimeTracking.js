import mongoose from "mongoose";

const timeTrackingSchema = new mongoose.Schema(
  {
    token_id: { type: String, required: true, unique: true, index: true },
    waiting_start: { type: Date, default: null },
    consult_start: { type: Date, default: null },
    consult_end: { type: Date, default: null },
    care_start: { type: Date, default: null },
    care_end: { type: Date, default: null },
    consult_note: { type: String, default: "" },
    referred_department: { type: String, default: "" },
    break_start: { type: Date, default: null },
    break_end: { type: Date, default: null }
  },
  { timestamps: true, collection: "time_tracking" }
);

export const TimeTracking = mongoose.model("TimeTracking", timeTrackingSchema);
