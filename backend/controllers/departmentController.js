import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";
import {
  createDepartment,
  deleteDepartment,
  listActiveDepartments,
  listAllDepartments,
  updateDepartment
} from "../services/departmentService.js";

export const listActiveHandler = asyncHandler(async (_req, res) => {
  const rows = await listActiveDepartments();
  return sendSuccess(res, rows, "Departments loaded");
});

export const listAllHandler = asyncHandler(async (_req, res) => {
  const rows = await listAllDepartments();
  return sendSuccess(res, rows, "Departments loaded");
});

export const createHandler = asyncHandler(async (req, res) => {
  const row = await createDepartment(req.body ?? {});
  return sendSuccess(res, row, "Department created", 201);
});

export const updateHandler = asyncHandler(async (req, res) => {
  const row = await updateDepartment(req.params.id, req.body ?? {});
  return sendSuccess(res, row, "Department updated");
});

export const deleteHandler = asyncHandler(async (req, res) => {
  const result = await deleteDepartment(req.params.id);
  return sendSuccess(res, result, "Department deleted");
});
