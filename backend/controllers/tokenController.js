import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";
import {
  branchToken,
  completeVisitAfterConsult,
  createToken,
  endConsulting,
  endLabTesting,
  endTreatment,
  getLiveQueue,
  getCompletedTokens,
  getTokenDetail,
  moveTokenToWaiting,
  recordBillingPayment,
  startConsulting,
  startLabTesting,
  startTreatment,
  revertTokenToAnchor,
  stepBackToken
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
  department: z.string().min(1, "department is required")
});

const endConsultSchema = z.object({
  consult_note: z.string().optional(),
  next_department: z.string().optional(),
  labs_ordered: z.boolean().optional()
});

const revertAnchorSchema = z.object({
  anchor: z.enum(["waiting", "consult_open", "consult_closed", "billing", "paid", "lab", "lab_done"])
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

export const stepBack = asyncHandler(async (req, res) => {
  const result = await stepBackToken(getTokenId(req));
  return sendSuccess(res, result, "Stepped back one stage");
});

export const revertToAnchor = asyncHandler(async (req, res) => {
  const { anchor } = revertAnchorSchema.parse(req.body ?? {});
  const result = await revertTokenToAnchor(getTokenId(req), anchor);
  return sendSuccess(res, result, "Visit reverted to selected stage");
});

export const startConsult = asyncHandler(async (req, res) => {
  const input = startConsultSchema.parse(req.body ?? {});
  const result = await startConsulting(getTokenId(req), input);
  return sendSuccess(res, result, "Consult started");
});

export const endConsult = asyncHandler(async (req, res) => {
  const input = endConsultSchema.parse(req.body ?? {});
  const result = await endConsulting(getTokenId(req), input);
  return sendSuccess(res, result, "Consult ended");
});

export const recordBillingPaymentHandler = asyncHandler(async (req, res) => {
  const result = await recordBillingPayment(getTokenId(req));
  return sendSuccess(res, result, "Payment recorded");
});

export const startLab = asyncHandler(async (req, res) => {
  const result = await startLabTesting(getTokenId(req));
  return sendSuccess(res, result, "Lab testing started");
});

export const endLab = asyncHandler(async (req, res) => {
  const result = await endLabTesting(getTokenId(req));
  return sendSuccess(res, result, "Lab testing ended");
});

export const startCare = asyncHandler(async (req, res) => {
  const result = await startTreatment(getTokenId(req));
  return sendSuccess(res, result, "Treatment started");
});

export const endCare = asyncHandler(async (req, res) => {
  const result = await endTreatment(getTokenId(req));
  return sendSuccess(res, result, "Treatment ended");
});

export const completeVisit = asyncHandler(async (req, res) => {
  const result = await completeVisitAfterConsult(getTokenId(req));
  return sendSuccess(res, result, "Visit completed");
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

export const getCompletedTokensHandler = asyncHandler(async (req, res) => {
  const rows = await getCompletedTokens({
    search: String(req.query?.search ?? "")
  });
  return sendSuccess(res, rows, "Completed tokens fetched");
});

export const getTokenDetailHandler = asyncHandler(async (req, res) => {
  const detail = await getTokenDetail(getTokenId(req));
  return sendSuccess(res, detail, "Token detail fetched");
});
