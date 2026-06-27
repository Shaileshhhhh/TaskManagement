import { z } from "zod";

/**
 * Shared Zod primitives that entity schemas extend. Keeping these in one place
 * means every route validates ids, urgency, statuses, etc. the same way.
 */

/** A UUID path/route param (matches our gen_random_uuid() primary keys). */
export const uuidSchema = z.string().uuid("Expected a valid UUID.");

/** `{ id: uuid }` — the common dynamic-route param shape. */
export const idParamSchema = z.object({ id: uuidSchema });

/** Enums mirrored from the database (types/database.types.ts Enums). */
export const urgencyLevelSchema = z.enum(["low", "medium", "high", "urgent"]);
export const projectStatusSchema = z.enum([
  "active",
  "on_hold",
  "completed",
  "archived",
]);
export const taskStatusSchema = z.enum(["todo", "in_progress", "done"]);

/** A non-empty, trimmed, length-bounded text field (titles, names). */
export const shortTextSchema = z
  .string()
  .trim()
  .min(1, "Required.")
  .max(200, "Too long (max 200 characters).");

/** An optional longer free-text field (descriptions, notes). */
export const longTextSchema = z
  .string()
  .trim()
  .max(5000, "Too long (max 5000 characters).")
  .optional();

/** An http(s) URL (used by task links). */
export const urlSchema = z.string().trim().url("Expected a valid URL.");
