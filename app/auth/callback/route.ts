import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * OAuth / PKCE session-exchange callback.
 *
 * Supabase redirects here with a `code` after sign-in flows that use the
 * authorization-code grant. We exchange it for a session (which sets the auth
 * cookies via the server client) and then redirect into the app.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // No code or exchange failed → send to login with an error flag.
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}

/** Only allow same-origin relative paths as the post-auth destination. */
function sanitizeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}
