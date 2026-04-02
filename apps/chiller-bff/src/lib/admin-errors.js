export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message, details) {
  return new ApiError(400, "BAD_REQUEST", message, details);
}

export function unauthorized(message = "Unauthorized", details) {
  return new ApiError(401, "ADMIN_UNAUTHORIZED", message, details);
}

export function forbidden(message = "Forbidden", details) {
  return new ApiError(403, "ADMIN_FORBIDDEN", message, details);
}

export function notFound(message = "Not found", details) {
  return new ApiError(404, "NOT_FOUND", message, details);
}

export function conflict(message = "Conflict", details) {
  return new ApiError(409, "CONFLICT", message, details);
}

export function internalError(message = "Internal error", details) {
  return new ApiError(500, "INTERNAL_ERROR", message, details);
}

export function formatApiError(error, requestId) {
  const status =
    typeof error?.status === "number" && Number.isFinite(error.status) ? error.status : 500;
  const code =
    typeof error?.code === "string" && error.code.trim() ? error.code : "INTERNAL_ERROR";
  const message =
    typeof error?.message === "string" && error.message.trim()
      ? error.message
      : "Unhandled error";

  return {
    status,
    body: {
      ok: false,
      code,
      error: message,
      requestId,
      ...(error?.details !== undefined ? { details: error.details } : {})
    }
  };
}
