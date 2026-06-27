/**
 * Typed API error classes. Each maps to an HTTP status and an optional machine
 * code. The central handler (lib/api/handler.ts) catches these and renders them
 * through the { error } envelope, so route code can simply `throw` them.
 */

/** Base class for all expected (non-bug) API errors. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
  }
}

/** 400 — request failed validation or was otherwise malformed. */
export class ValidationError extends ApiError {
  /** Field-level issues, when available (e.g. from Zod). */
  readonly details?: unknown;

  constructor(
    message = "Invalid request.",
    details?: unknown,
    code = "validation_error",
  ) {
    super(message, 400, code);
    this.details = details;
  }
}

/** 401 — no valid session / not signed in. */
export class UnauthorizedError extends ApiError {
  constructor(message = "Authentication required.", code = "unauthorized") {
    super(message, 401, code);
  }
}

/** 403 — signed in but not allowed to perform this action. */
export class ForbiddenError extends ApiError {
  constructor(message = "You do not have access to this resource.", code = "forbidden") {
    super(message, 403, code);
  }
}

/** 404 — resource does not exist (or is not visible to this user). */
export class NotFoundError extends ApiError {
  constructor(message = "Not found.", code = "not_found") {
    super(message, 404, code);
  }
}

/** 409 — conflict, e.g. a uniqueness violation (already checked in). */
export class ConflictError extends ApiError {
  constructor(message = "Conflict.", code = "conflict") {
    super(message, 409, code);
  }
}

/** 500 — unexpected server error. */
export class InternalError extends ApiError {
  constructor(message = "Something went wrong.", code = "internal_error") {
    super(message, 500, code);
  }
}
