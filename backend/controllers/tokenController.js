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
  moveTokenToWaiting,
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

const startConsultSchema = z.object({
  department: z.string().optional().default("")
});

const getTokenId = (req = {}) => String(req?.params?.id ?? "").trim();

export const createTokenHandler = asyncHandler(async (req, res) => {
  const input = createTokenSchema.parse(req.body ?? {});
  const token = await createToken(input);
  return sendSuccess(res, token, "Token created", 201);
});

export const startWaiting = asyncHandler(async (req, res) => {
  const result = await moveTokenToWaiting(getTokenId(req));
  return sendSuccess(res, result, "Moved token to waiting");
});

export const startConsult = asyncHandler(async (req, res) => {
  const input = startConsultSchema.parse(req.body ?? {});
  const result = await startConsulting(getTokenId(req), input);
  return sendSuccess(res, result, "Consult started");
});

export const endConsult = asyncHandler(async (req, res) => {
  const result = await endConsulting(getTokenId(req), {});
  return sendSuccess(res, result, "Consult ended");
});

export const startCare = asyncHandler(async (req, res) => {
  const result = await startTreatment(getTokenId(req));
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

export const getLiveQueueHandler = asyncHandler(async (req, res) => {
  const queue = await getLiveQueue({
    search: String(req.query?.search ?? ""),
    department: String(req.query?.department ?? "")
  });
  return sendSuccess(res, queue, "Live queue fetched");
});

export const getTokenDetailHandler = asyncHandler(async (req, res) => {
  const detail = await getTokenDetail(getTokenId(req));
  return sendSuccess(res, detail, "Token detail fetched");
});
