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
    }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "tokens"
  }
);

tokenSchema.index({ visit_id: 1, department: 1, created_at: -1 });

export const Token = mongoose.model("Token", tokenSchema);
