import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MarketTicker } from "./MarketTicker";

export function AppShell({ children }: { children: ReactNode }) {
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
