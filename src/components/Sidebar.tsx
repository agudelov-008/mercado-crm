import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Shield,
  Building2,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { BRAND_LOGO_SOLO, BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import {
  canAccessAffiliatesModule,
  canAccessDashboardNav,
  canAccessTasksNav,
  canAccessUserManagement,
} from "@/lib/role-rbac";

export function Sidebar() {
  const { profileRole } = useApp();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const nav: { to: string; label: string; icon: typeof LayoutDashboard }[] = [];

  if (canAccessDashboardNav(profileRole)) {
    nav.push({ to: "/", label: "Dashboard", icon: LayoutDashboard });
  }

  nav.push({ to: "/clients", label: "My Clients", icon: Users });

  if (canAccessTasksNav(profileRole)) {
    nav.push({ to: "/calendar", label: "Calendario", icon: CalendarDays });
  }

  if (canAccessUserManagement(profileRole)) {
    nav.push({ to: "/users", label: "User Management", icon: Shield });
  }

  if (canAccessAffiliatesModule(profileRole)) {
    nav.push({ to: "/affiliates", label: "Afiliadoras", icon: Building2 });
  }

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-surface/40">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border">
        <img
          src={BRAND_LOGO_SOLO}
          alt={`${BRAND_NAME} isotipo`}
          className="h-9 w-9 object-contain shrink-0"
        />
        <div className="leading-tight min-w-0">
          <div className="text-sm font-semibold tracking-tight truncate">
            {BRAND_NAME}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {BRAND_TAGLINE}
          </div>
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
    </aside>
  );
}
