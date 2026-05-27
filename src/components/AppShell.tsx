import type { ReactNode } from "react";
import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useApp } from "@/lib/app-context";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MarketTicker } from "./MarketTicker";

const AFFILIATE_ALLOWED_PREFIX = "/clients";

export function AppShell({ children }: { children: ReactNode }) {
  const { profileRole } = useApp();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    if (profileRole !== "Affiliate") return;
    if (!pathname.startsWith(AFFILIATE_ALLOWED_PREFIX)) {
      navigate({ to: "/clients", replace: true });
    }
  }, [profileRole, pathname, navigate]);

  return (
    <div className="dark min-h-screen flex flex-col bg-background text-foreground">
      <MarketTicker />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
