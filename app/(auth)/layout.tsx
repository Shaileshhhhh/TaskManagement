import { type ReactNode } from "react";

/**
 * Auth route-group shell. Centers the auth cards on a neutral background.
 * No session guard here — these pages are reachable while signed out.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
