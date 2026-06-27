import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

/**
 * Service-role Supabase client — SERVER / EDGE ONLY.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY and therefore BYPASSES Row Level Security.
 * It must never be imported into a client component or any file that could ship
 * to the browser — an ESLint `no-restricted-imports` rule enforces this (see
 * eslint.config.mjs).
 *
 * Use it ONLY for trusted side effects that legitimately need to skip RLS:
 * the notification email sender, cron Edge Functions, and similar admin tasks.
 * Never reach for it just to "make a query work" — that almost always means a
 * missing RLS policy, not a reason to bypass RLS.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. The admin client requires it and must only run server-side.",
    );
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
