import { NextResponse } from "next/server";

import { ApiError, InternalError } from "@/lib/api/errors";

/**
 * API response envelope helpers.
 *
 * Every route returns one of two shapes, never a bare value:
 *   success → { data: T }
 *   failure → { error: { message, code? } }
 * with the HTTP status set appropriately.
 */

export type ApiSuccess<T> = { data: T };
export type ApiFailure = { error: { message: string; code?: string; details?: unknown } };

/** Build a success response: `{ data }` with the given status (default 200). */
export function ok<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ data }, { status });
}

/** Build a created response: `{ data }` with status 201. */
export function created<T>(data: T): NextResponse<ApiSuccess<T>> {
  return ok(data, 201);
}

/** Build a failure response from an explicit message/status. */
export function fail(
  message: string,
  status: number,
  code?: string,
  details?: unknown,
): NextResponse<ApiFailure> {
  return NextResponse.json({ error: { message, code, details } }, { status });
}

/**
 * Render any thrown value as a failure response. Known ApiErrors keep their
 * status/code; anything else is treated as an unexpected 500 (details are not
 * leaked to the client).
 */
export function failFromError(err: unknown): NextResponse<ApiFailure> {
  if (err instanceof ApiError) {
    const details =
      "details" in err ? (err as { details?: unknown }).details : undefined;
    return fail(err.message, err.status, err.code, details);
  }

  // Unknown error — log server-side, return a generic 500.
  console.error("[api] unhandled error:", err);
  const internal = new InternalError();
  return fail(internal.message, internal.status, internal.code);
}
