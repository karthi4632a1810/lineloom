import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";
import {
  branchToken,
  createToken,
  endConsulting,
  endTreatment,
  getLiveQueue,
  getTokenDetail,
  startConsulting,
  startTreatment
} from "../services/tokenService.js";

const createTokenSchema = z.object({
  patient_id: z.string().min(1),
  visit_id: z.string().min(1),
  department: z.string().min(1)
});

const branchSchema = z.object({
  new_department: z.string().min(1)
});

const endConsultSchema = z.object({
  consult_note: z.string().optional().default(""),
  next_department: z.string().optional().default("")
});

const startTreatmentSchema = z.object({
  department: z.string().min(1)
});

const getTokenId = (req = {}) => String(req?.params?.id ?? "").trim();

export const createTokenHandler = asyncHandler(async (req, res) => {
  const input = createTokenSchema.parse(req.body ?? {});
  const token = await createToken(input);
  return sendSuccess(res, token, "Token created", 201);
});

export const startWaiting = asyncHandler(async (req, res) => {
  const result = await getTokenDetail(getTokenId(req));
  return sendSuccess(res, result, "Token already in waiting state");
});

export const startConsult = asyncHandler(async (req, res) => {
  const result = await startConsulting(getTokenId(req));
  return sendSuccess(res, result, "Consult started");
});

export const endConsult = asyncHandler(async (req, res) => {
  const input = endConsultSchema.parse(req.body ?? {});
  const result = await endConsulting(getTokenId(req), input);
  return sendSuccess(res, result, "Consult ended");
});

export const startCare = asyncHandler(async (req, res) => {
  const input = startTreatmentSchema.parse(req.body ?? {});
  const result = await startTreatment(getTokenId(req), input);
  return sendSuccess(res, result, "Treatment started");
});

export const endCare = asyncHandler(async (req, res) => {
  const result = await endTreatment(getTokenId(req));
  return sendSuccess(res, result, "Treatment ended");
});

export const branchTokenHandler = asyncHandler(async (req, res) => {
  const parsed = branchSchema.parse(req.body ?? {});
  const token = await branchToken(getTokenId(req), parsed.new_department);
  return sendSuccess(res, token, "Token branched", 201);
});

export const getLiveQueueHandler = asyncHandler(async (_req, res) => {
  const queue = await getLiveQueue();
  return sendSuccess(res, queue, "Live queue fetched");
});

export const getTokenDetailHandler = asyncHandler(async (req, res) => {
  const detail = await getTokenDetail(getTokenId(req));
  return sendSuccess(res, detail, "Token detail fetched");
});
