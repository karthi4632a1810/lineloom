import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";

export const requireAuth = (req, _res, next) => {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return next(new ApiError("Unauthorized", 401));
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    req.user = {
      id: decoded?.sub ?? "",
      role: decoded?.role ?? "nurse",
      email: decoded?.email ?? ""
    };
    return next();
  } catch {
    return next(new ApiError("Invalid or expired token", 401));
  }
};

export const authorizeRoles = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user?.role ?? "")) {
    return next(new ApiError("Forbidden", 403));
  }
  return next();
};
