import { Bell, Search, ChevronDown, LogOut } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { getProfileRoleLabel } from "@/lib/role-rbac";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export function Topbar() {
  const { profileRole, currentUser } = useApp();
  const { handleLogout } = useAuth();

  const roleLabel =
    profileRole !== null ? getProfileRoleLabel(profileRole) : "…";

  return (
    <header className="h-16 border-b border-border bg-surface/60 backdrop-blur flex items-center px-6 gap-4">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clients, deals, tickers…"
          className="pl-9 bg-surface-elevated border-border h-9"
        />
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <div className="hidden sm:flex items-center gap-2 px-3 h-9 rounded-md bg-surface-elevated border border-border text-sm">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="font-medium">{roleLabel}</span>
        </div>

        <button
          type="button"
          className="relative h-9 w-9 rounded-md bg-surface-elevated border border-border hover:border-primary/50 flex items-center justify-center transition-colors"
          aria-label="Notificaciones"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-success" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 pl-3 border-l border-border outline-none">
            <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
              {currentUser.initials}
            </div>
            <div className="leading-tight hidden sm:block text-left">
              <div className="text-sm font-medium">{currentUser.name}</div>
              <div className="text-[10px] text-muted-foreground">{roleLabel}</div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="truncate">{currentUser.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void handleLogout()}>
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
