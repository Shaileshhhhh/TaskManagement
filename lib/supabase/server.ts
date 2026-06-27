import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database.types";

/**
 * Server Supabase client, cookie-based and RLS-scoped to the signed-in user.
 *
 * Use this in Server Components, Route Handlers, and Server Actions. It reads
 * and writes the auth cookies so the session stays in sync. It uses the anon
 * key — RLS is the authorization boundary, NOT this client. For privileged,
 * RLS-bypassing work use lib/supabase/admin instead (server/edge only).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // `setAll` was called from a Server Component, where cookies are
            // read-only. Safe to ignore when middleware refreshes the session.
          }
        },
      },
    },
  );
}
