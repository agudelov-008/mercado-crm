import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { DollarSign, Users, Trophy, Clock, ArrowUpRight } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { ClientCard } from "@/components/ClientCard";
import { CallModal } from "@/components/CallModal";
import { MessageModal } from "@/components/MessageModal";
import { clients, type Client } from "@/lib/mock-data";
import { useApp } from "@/lib/app-context";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  const { role, currentUser } = useApp();
  const navigate = useNavigate();
  const [callClient, setCallClient] = useState<Client | null>(null);
  const [msgClient, setMsgClient] = useState<Client | null>(null);

  const myClients = role === "Agent"
    ? clients.filter(c => c.assignedAgent === currentUser.name)
    : clients;
  const priority = myClients.slice(0, 6);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Welcome back</div>
          <h1 className="text-2xl font-semibold mt-1">{currentUser.name.split(" ")[0]} · Trading Floor Overview</h1>
        </div>
        <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-md bg-success/10 border border-success/30 text-success">
          <ArrowUpRight className="h-3.5 w-3.5" /> Portfolio up +1.84% today
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="AUM" value="$128.4M" delta="+4.2% MTD" up icon={DollarSign} accent="success" />
        <MetricCard label="Active Leads" value="47" delta="+8 this week" up icon={Users} accent="info" />
        <MetricCard label="Closed Deals · Win Rate" value="68%" delta="32 of 47 YTD" up icon={Trophy} accent="primary" />
        <MetricCard label="Pending Follow-ups" value="14" delta="3 overdue" up={false} icon={Clock} accent="warning" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-xl border border-border bg-card/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Priority Client Feed</h2>
              <p className="text-xs text-muted-foreground">High-touch accounts assigned to you</p>
            </div>
            <button onClick={() => navigate({ to: "/clients" })} className="text-xs text-primary hover:underline">View all →</button>
          </div>
          <div className="space-y-2.5">
            {priority.map((c) => (
              <ClientCard
                key={c.id}
                client={c}
                onCall={() => setCallClient(c)}
                onMessage={() => setMsgClient(c)}
                onOpen={() => navigate({ to: "/clients/$id", params: { id: c.id } })}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-gradient-surface p-5">
            <h3 className="text-sm font-semibold">Today's Compliance</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Items requiring attention</p>
            <div className="mt-4 space-y-2">
              {[
                { label: "KYC refresh due", count: 3, tone: "bg-warning/15 text-warning" },
                { label: "Risk profiles expiring", count: 2, tone: "bg-destructive/15 text-destructive" },
                { label: "Quarterly reports queued", count: 8, tone: "bg-info/15 text-info" },
                { label: "Rebalancing proposals", count: 5, tone: "bg-success/15 text-success" },
              ].map((it) => (
                <div key={it.label} className="flex items-center justify-between p-2.5 rounded-md bg-surface-elevated border border-border">
                  <span className="text-xs">{it.label}</span>
                  <span className={`text-xs font-semibold tabular-nums px-2 py-0.5 rounded ${it.tone}`}>{it.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-gradient-surface p-5">
            <h3 className="text-sm font-semibold">Sector Allocation · Aggregate</h3>
            <div className="mt-4 space-y-2.5">
              {[
                { sector: "Technology", pct: 32, color: "var(--info)" },
                { sector: "Financials", pct: 21, color: "var(--success)" },
                { sector: "Energy", pct: 14, color: "var(--warning)" },
                { sector: "Healthcare", pct: 12, color: "var(--primary)" },
                { sector: "Consumer", pct: 11, color: "var(--destructive)" },
                { sector: "Other", pct: 10, color: "var(--muted-foreground)" },
              ].map((s) => (
                <div key={s.sector}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{s.sector}</span>
                    <span className="tabular-nums text-muted-foreground">{s.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <CallModal open={!!callClient} onOpenChange={(o) => !o && setCallClient(null)} client={callClient} />
      <MessageModal open={!!msgClient} onOpenChange={(o) => !o && setMsgClient(null)} client={msgClient} />
    </div>
  );
}
