import { logger } from "../utils/logger.js";

export const notFoundHandler = (req, res, _next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
};

export const errorHandler = (error, _req, res, _next) => {
  const isValidationError = error?.name === "ZodError";
  const statusCode = Number(error?.statusCode ?? (isValidationError ? 400 : 500));
  const clientMessage = isValidationError
    ? "Invalid request payload"
    : statusCode >= 500
      ? "Something went wrong"
      : error?.message ?? "Request failed";
  logger.error("API error", {
    statusCode,
    message: error?.message ?? "Unknown error",
    stack: error?.stack ?? null
  });
  res.status(statusCode).json({
    success: false,
    message: clientMessage
  });
};
