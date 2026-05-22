import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, Phone, MessageCircle, Filter } from "lucide-react";
import { clients, formatCurrency, type Client } from "@/lib/mock-data";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CallModal } from "@/components/CallModal";
import { MessageModal } from "@/components/MessageModal";

export const Route = createFileRoute("/clients/")({ component: ClientsPage });

const tierStyles: Record<string, string> = {
  Conservative: "bg-info/15 text-info border-info/30",
  Moderate: "bg-warning/15 text-warning border-warning/30",
  Aggressive: "bg-destructive/15 text-destructive border-destructive/30",
};
const kycStyles: Record<string, string> = {
  Verified: "bg-success/15 text-success border-success/30",
  Pending: "bg-warning/15 text-warning border-warning/30",
  Expired: "bg-destructive/15 text-destructive border-destructive/30",
};

function ClientsPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [tier, setTier] = useState("all");
  const [agent, setAgent] = useState("all");
  const [bucket, setBucket] = useState("all");
  const [callClient, setCallClient] = useState<Client | null>(null);
  const [msgClient, setMsgClient] = useState<Client | null>(null);

  const agentList = useMemo(() => Array.from(new Set(clients.map(c => c.assignedAgent))), []);

  const filtered = clients.filter(c => {
    if (q && !c.name.toLowerCase().includes(q.toLowerCase()) && !c.email.toLowerCase().includes(q.toLowerCase())) return false;
    if (tier !== "all" && c.tier !== tier) return false;
    if (agent !== "all" && c.assignedAgent !== agent) return false;
    if (bucket === "lt1m" && c.portfolioValue >= 1_000_000) return false;
    if (bucket === "1to5m" && (c.portfolioValue < 1_000_000 || c.portfolioValue >= 5_000_000)) return false;
    if (bucket === "gt5m" && c.portfolioValue < 5_000_000) return false;
    return true;
  });

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Clients</h1>
        <p className="text-sm text-muted-foreground">{filtered.length} of {clients.length} accounts</p>
      </div>

      <div className="rounded-xl border border-border bg-card/40 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email…" className="pl-9 bg-surface-elevated border-border" />
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground"><Filter className="h-3.5 w-3.5" /> Filters</div>
        <Select value={tier} onValueChange={setTier}>
          <SelectTrigger className="w-[170px] bg-surface-elevated border-border"><SelectValue placeholder="Risk Profile" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All risk profiles</SelectItem>
            <SelectItem value="Conservative">Conservative</SelectItem>
            <SelectItem value="Moderate">Moderate</SelectItem>
            <SelectItem value="Aggressive">Aggressive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={bucket} onValueChange={setBucket}>
          <SelectTrigger className="w-[180px] bg-surface-elevated border-border"><SelectValue placeholder="Account Value" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All account sizes</SelectItem>
            <SelectItem value="lt1m">Under $1M</SelectItem>
            <SelectItem value="1to5m">$1M – $5M</SelectItem>
            <SelectItem value="gt5m">Over $5M</SelectItem>
          </SelectContent>
        </Select>
        <Select value={agent} onValueChange={setAgent}>
          <SelectTrigger className="w-[200px] bg-surface-elevated border-border"><SelectValue placeholder="Assigned Agent" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {agentList.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-elevated/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Client</th>
              <th className="text-left px-4 py-3 font-medium">Tier</th>
              <th className="text-left px-4 py-3 font-medium">KYC</th>
              <th className="text-right px-4 py-3 font-medium">Portfolio</th>
              <th className="text-right px-4 py-3 font-medium">Target</th>
              <th className="text-left px-4 py-3 font-medium">Agent</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-border hover:bg-surface-elevated/40 transition-colors cursor-pointer" onClick={() => navigate({ to: "/clients/$id", params: { id: c.id } })}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: c.avatarColor }}>
                      {c.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><span className={`text-[10px] px-1.5 py-0.5 rounded border ${tierStyles[c.tier]}`}>{c.tier}</span></td>
                <td className="px-4 py-3"><span className={`text-[10px] px-1.5 py-0.5 rounded border ${kycStyles[c.kyc]}`}>{c.kyc}</span></td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(c.portfolioValue)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatCurrency(c.targetInvestment)}</td>
                <td className="px-4 py-3 text-xs">{c.assignedAgent}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setCallClient(c)} className="h-8 w-8 rounded-md bg-success/15 hover:bg-success/25 text-success border border-success/30 flex items-center justify-center"><Phone className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setMsgClient(c)} className="h-8 w-8 rounded-md bg-info/15 hover:bg-info/25 text-info border border-info/30 flex items-center justify-center"><MessageCircle className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CallModal open={!!callClient} onOpenChange={(o) => !o && setCallClient(null)} client={callClient} />
      <MessageModal open={!!msgClient} onOpenChange={(o) => !o && setMsgClient(null)} client={msgClient} />
    </div>
  );
}
