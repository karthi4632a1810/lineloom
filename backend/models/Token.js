import mongoose from "mongoose";

const tokenSchema = new mongoose.Schema(
  {
    token_id: { type: String, required: true, unique: true, index: true },
    patient_id: { type: String, required: true, index: true },
    visit_id: { type: String, required: true, index: true },
    patient_name: { type: String, default: "", trim: true },
    patient_phone: { type: String, default: "", trim: true },
    department: { type: String, required: true, trim: true },
    parent_token_id: { type: String, default: null, index: true },
    status: {
      type: String,
      enum: ["WAITING", "ACTIVE", "CONSULTING", "IN_TREATMENT", "COMPLETED"],
      default: "WAITING"
    },
    /** Display number for staff; unique among non-completed tokens in the same department. */
    department_queue_no: { type: Number, default: null, min: 1 }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "tokens"
  }
);

tokenSchema.index({ visit_id: 1, department: 1, created_at: -1 });
/** Prevents two active visits in the same department sharing the same queue number. */
tokenSchema.index(
  { department: 1, department_queue_no: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["WAITING", "ACTIVE", "CONSULTING", "IN_TREATMENT"] },
      department_queue_no: { $gt: 0 }
    }
  }
);

export const Token = mongoose.model("Token", tokenSchema);
