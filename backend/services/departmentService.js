import { Department } from "../models/Department.js";
import { ApiError } from "../utils/apiError.js";

const DEFAULT_NAMES = ["General Medicine", "ENT", "Emergency", "Cardiology"];

export const ensureDepartmentsSeeded = async () => {
  const count = await Department.countDocuments();
  if (count > 0) {
    return;
  }
  await Department.insertMany(
    DEFAULT_NAMES.map((name, index) => ({
      name,
      sort_order: index,
      is_active: true
    }))
  );
};

export const listActiveDepartments = async () => {
  await ensureDepartmentsSeeded();
  return Department.find({ is_active: true }).sort({ sort_order: 1, name: 1 }).lean();
};

export const listAllDepartments = async () => {
  await ensureDepartmentsSeeded();
  return Department.find({}).sort({ sort_order: 1, name: 1 }).lean();
};

export const isActiveDepartmentName = async (name = "") => {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) {
    return false;
  }
  await ensureDepartmentsSeeded();
  const doc = await Department.findOne({ name: trimmed, is_active: true }).lean();
  return Boolean(doc);
};

export const createDepartment = async (input = {}) => {
  const name = String(input?.name ?? "").trim();
  if (!name) {
    throw new ApiError("Department name is required", 400);
  }
  try {
    const created = await Department.create({
      name,
      sort_order: Number(input?.sort_order ?? 0) || 0,
      is_active: input?.is_active !== false
    });
    return created.toObject();
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError("A department with this name already exists", 400);
    }
    throw error;
  }
};

export const updateDepartment = async (id = "", input = {}) => {
  const doc = await Department.findById(id);
  if (!doc) {
    throw new ApiError("Department not found", 404);
  }
  if (input.name != null) {
    doc.name = String(input.name).trim();
  }
  if (input.sort_order != null) {
    doc.sort_order = Number(input.sort_order) || 0;
  }
  if (input.is_active != null) {
    doc.is_active = Boolean(input.is_active);
  }
  try {
    await doc.save();
    return doc.toObject();
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError("A department with this name already exists", 400);
    }
    throw error;
  }
};

export const deleteDepartment = async (id = "") => {
  const doc = await Department.findByIdAndDelete(id);
  if (!doc) {
    throw new ApiError("Department not found", 404);
  }
  return { deleted: true };
};
