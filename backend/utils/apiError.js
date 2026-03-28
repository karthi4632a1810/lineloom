export class ApiError extends Error {
  constructor(
    message = "An unexpected error occurred",
    statusCode = 500,
    details = null
  ) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}
