import { withAuth } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";

/**
 * Throwaway probe at /api/health-check — verifies the Phase 2 scaffolding:
 * withAuth returns 401 with no session and the { data } envelope with one.
 * Safe to delete once real routes exist. This is NOT part of the API surface.
 */
export const GET = withAuth(async ({ user }) => {
  return ok({ status: "ok", userId: user.id });
});
