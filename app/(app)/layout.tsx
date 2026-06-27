import { type ReactNode } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { AppTopbar } from "@/components/layout/app-topbar";
import { AppSidebar } from "@/components/layout/app-sidebar";

/**
 * Authenticated app shell. Server-side session guard: no user → redirect to
 * /login. (The middleware also guards these routes; this is defense in depth
 * and gives us the user record for the chrome.)
 */
export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const displayName = profile?.full_name ?? profile?.email ?? user.email ?? "User";

  return (
    <div className="flex min-h-svh">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar displayName={displayName} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
