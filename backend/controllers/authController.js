import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";
import { loginUser, registerUser } from "../services/authService.js";

export const register = asyncHandler(async (req, res) => {
  const payload = await registerUser(req.body ?? {});
  return sendSuccess(res, payload, "User registered", 201);
});

export const login = asyncHandler(async (req, res) => {
  const payload = await loginUser(req.body ?? {});
  return sendSuccess(res, payload, "Login successful");
});
