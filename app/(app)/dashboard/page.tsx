/**
 * Dashboard placeholder. The real dashboard (stat cards, urgent/pending lists,
 * the get_my_dashboard RPC) is built in Phase 9. This stub exists so the
 * post-login landing route resolves and the auth shell can be exercised.
 */
export default function DashboardPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground">
        You&apos;re signed in. Project, task, and reporting views arrive in later
        phases.
      </p>
    </div>
  );
}
