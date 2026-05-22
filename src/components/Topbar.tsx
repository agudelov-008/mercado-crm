import { Bell, Search, ChevronDown, Check } from "lucide-react";
import { useApp, type Role } from "@/lib/app-context";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export function Topbar() {
  const { role, setRole, currentUser } = useApp();
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
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 h-9 rounded-md bg-surface-elevated border border-border hover:border-primary/50 transition-colors text-sm">
            <span className={`h-2 w-2 rounded-full ${role === "Administrator" ? "bg-warning" : "bg-info"}`} />
            <span className="font-medium">{role}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Preview as role</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(["Administrator", "Agent"] as Role[]).map((r) => (
              <DropdownMenuItem key={r} onClick={() => setRole(r)} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{r}</div>
                  <div className="text-xs text-muted-foreground">
                    {r === "Administrator" ? "Full access + user mgmt" : "Dashboard, clients, tasks"}
                  </div>
                </div>
                {role === r && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <button className="relative h-9 w-9 rounded-md bg-surface-elevated border border-border hover:border-primary/50 flex items-center justify-center transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-success" />
        </button>

        <div className="flex items-center gap-2 pl-3 border-l border-border">
          <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
            {currentUser.initials}
          </div>
          <div className="leading-tight hidden sm:block">
            <div className="text-sm font-medium">{currentUser.name}</div>
            <div className="text-[10px] text-muted-foreground">{role}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
