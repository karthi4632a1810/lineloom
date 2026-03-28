import mongoose from "mongoose";

const departmentFlowSchema = new mongoose.Schema(
  {
    source_token_id: { type: String, required: true, index: true },
    destination_token_id: { type: String, required: true, index: true },
    from_department: { type: String, required: true },
    to_department: { type: String, required: true }
  },
  { timestamps: true, collection: "department_flow" }
);

export const DepartmentFlow = mongoose.model("DepartmentFlow", departmentFlowSchema);
