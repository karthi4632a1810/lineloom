import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password_hash: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "nurse", "doctor"],
      default: "nurse"
    }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
