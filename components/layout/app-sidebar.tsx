import Link from "next/link";
import {
  LayoutDashboard,
  FolderKanban,
  Calendar,
  Clock,
  Bell,
  Activity,
} from "lucide-react";

/**
 * Static app navigation. Links point at the (app) route group. Pages beyond
 * the dashboard are built in later phases; the nav is laid out now so the shell
 * is complete.
 */
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/attendance", label: "Attendance", icon: Clock },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/activity", label: "Activity", icon: Activity },
] as const;

export function AppSidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r bg-muted/20 p-4 md:block">
      <div className="mb-6 px-2 text-lg font-semibold tracking-tight">TaskCo</div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
