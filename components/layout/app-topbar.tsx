"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Top bar for the authenticated shell: shows who is signed in and a sign-out
 * action. Sign-out clears the Supabase session and returns to /login.
 */
export function AppTopbar({ displayName }: { displayName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <div className="text-sm text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{displayName}</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={signOut}
        disabled={loading}
      >
        <LogOut className="size-4" aria-hidden />
        {loading ? "Signing out…" : "Sign out"}
      </Button>
    </header>
  );
}
