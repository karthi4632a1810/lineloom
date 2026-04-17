import mongoose from "mongoose";

const modelVersionSchema = new mongoose.Schema(
  {
    model_key: { type: String, required: true, unique: true },
    version_tag: { type: String, default: "1.0.0" },
    trained_at: { type: Date, default: Date.now },
    metrics_json: { type: String, default: "{}" }
  },
  { timestamps: true, collection: "model_versions" }
);

export const ModelVersion = mongoose.model("ModelVersion", modelVersionSchema);
