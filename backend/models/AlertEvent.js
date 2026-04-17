import mongoose from "mongoose";

const alertEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      index: true
    },
    department: { type: String, required: true, index: true },
    token_id: { type: String, default: null, index: true },
    message: { type: String, required: true },
    severity: { type: String, enum: ["info", "warn", "crit"], default: "warn" },
    acknowledged_at: { type: Date, default: null },
    acknowledged_by: { type: String, default: null }
  },
  { timestamps: true, collection: "alert_events" }
);

alertEventSchema.index({ createdAt: -1 });

export const AlertEvent = mongoose.model("AlertEvent", alertEventSchema);
