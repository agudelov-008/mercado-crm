import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Shield,
  TrendingUp,
  Building2,
} from "lucide-react";
import { useApp } from "@/lib/app-context";

const baseNav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clients", label: "My Clients", icon: Users },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
];

export function Sidebar() {
  const { profileRole } = useApp();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const isAffiliate = profileRole === "Affiliate";

  const nav = isAffiliate
    ? [{ to: "/clients", label: "My Clients", icon: Users }]
    : [...baseNav];

  if (profileRole === "Admin") {
    nav.push({ to: "/users", label: "User Management", icon: Shield });
  }
  if (!isAffiliate && profileRole === "Admin") {
    nav.push({ to: "/affiliates", label: "Afiliadoras", icon: Building2 });
  }

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-surface/40">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-border">
        <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
          <TrendingUp className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">Quant Capital</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Wealth CRM</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all ${
                active
                  ? "bg-primary/15 text-foreground border border-primary/30 shadow-glow"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border">
        <div className="rounded-lg bg-gradient-surface border border-border p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Market Status</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse-dot" />
            <span className="text-xs font-medium">Open · NYSE</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Closes in 3h 47m</div>
        </div>
      </div>
    </aside>
  );
}
