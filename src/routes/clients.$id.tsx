import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Phone, MessageCircle, Mail, Building2, ShieldCheck, FileText, Calendar, StickyNote, Users } from "lucide-react";
import { clients, timelineNotes, assignmentHistory, formatCurrency, type Client } from "@/lib/mock-data";
import { CallModal } from "@/components/CallModal";
import { MessageModal } from "@/components/MessageModal";

export const Route = createFileRoute("/clients/$id")({ component: ClientDetail });

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
const typeIcon = { call: Phone, message: MessageCircle, note: StickyNote, meeting: Calendar };

function ClientDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const client = clients.find(c => c.id === id) as Client | undefined;
  const [callOpen, setCallOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);

  if (!client) {
    return (
      <div className="p-8">
        <p>Client not found.</p>
        <Link to="/clients" className="text-primary hover:underline">Back to clients</Link>
      </div>
    );
  }

  const notes = timelineNotes.filter(n => n.clientId === client.id);
  const history = assignmentHistory.filter(h => h.clientId === client.id);
  const progress = Math.min(100, (client.portfolioValue / client.targetInvestment) * 100);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      <button onClick={() => navigate({ to: "/clients" })} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to clients
      </button>

      <div className="rounded-xl border border-border bg-gradient-surface p-6 shadow-elegant">
        <div className="flex items-start gap-5 flex-wrap">
          <div className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-semibold text-white" style={{ background: client.avatarColor }}>
            {client.name.split(" ").map(n => n[0]).join("")}
          </div>
          <div className="flex-1 min-w-[240px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold">{client.name}</h1>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${tierStyles[client.tier]}`}>{client.tier}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${kycStyles[client.kyc]} flex items-center gap-1`}>
                <ShieldCheck className="h-3 w-3" /> KYC {client.kyc}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
              <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{client.email}</span>
              <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{client.phone}</span>
              <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{client.netWorthBracket}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCallOpen(true)} className="h-10 px-4 rounded-md bg-success/15 hover:bg-success/25 text-success border border-success/30 flex items-center gap-2 text-sm font-medium">
              <Phone className="h-4 w-4" /> Llamar
            </button>
            <button onClick={() => setMsgOpen(true)} className="h-10 px-4 rounded-md bg-info/15 hover:bg-info/25 text-info border border-info/30 flex items-center gap-2 text-sm font-medium">
              <MessageCircle className="h-4 w-4" /> Escribir
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 rounded-lg bg-surface border border-border">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Portfolio Value</div>
            <div className="text-xl font-semibold tabular-nums mt-1">{formatCurrency(client.portfolioValue)}</div>
          </div>
          <div className="p-3 rounded-lg bg-surface border border-border">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Target Investment</div>
            <div className="text-xl font-semibold tabular-nums mt-1">{formatCurrency(client.targetInvestment)}</div>
          </div>
          <div className="p-3 rounded-lg bg-surface border border-border">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Funding Progress</div>
            <div className="text-xl font-semibold tabular-nums mt-1 text-success">{progress.toFixed(0)}%</div>
            <div className="mt-1.5 h-1.5 rounded-full bg-surface-elevated overflow-hidden">
              <div className="h-full bg-gradient-success" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="p-3 rounded-lg bg-surface border border-border">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Assigned Agent</div>
            <div className="text-sm font-semibold mt-1">{client.assignedAgent}</div>
            <div className="text-[10px] text-muted-foreground">Last contact · {client.lastContact}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-card/40 p-5">
            <h2 className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Financial Profile</h2>
            <div className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">Investment Interests</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {client.interests.map(i => (
                <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary">{i}</span>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/40 p-5">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Calendar className="h-4 w-4" /> Agent Interaction Timeline</h2>
            <div className="mt-5 relative">
              <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" />
              {notes.map((n) => {
                const Icon = typeIcon[n.type];
                return (
                  <div key={n.id} className="relative pl-10 pb-5 last:pb-0">
                    <div className="absolute left-0 top-0 h-8 w-8 rounded-full bg-surface-elevated border border-border flex items-center justify-center">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="rounded-lg bg-surface border border-border p-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">{n.agent}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary uppercase tracking-wider">{n.type}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {new Date(n.date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                        </span>
                      </div>
                      <p className="text-sm mt-2 text-foreground/90">{n.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card/40 p-5">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Assignment History</h2>
            <p className="text-xs text-muted-foreground">Audit trail</p>
            <div className="mt-4 relative">
              <div className="absolute left-[5px] top-1 bottom-1 w-px bg-border" />
              {history.map((h) => (
                <div key={h.id} className="relative pl-6 pb-4 last:pb-0">
                  <div className="absolute left-0 top-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
                  <div className="text-xs font-medium">{h.text}</div>
                  <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5">{h.date}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-gradient-surface p-5">
            <h3 className="text-sm font-semibold">Quick Stats</h3>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Account opened</span><span>Oct 02, 2024</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">YTD return</span><span className="text-success">+12.4%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Risk score</span><span>72 / 100</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Holdings</span><span>34 positions</span></div>
            </div>
          </div>
        </div>
      </div>

      <CallModal open={callOpen} onOpenChange={setCallOpen} client={client} />
      <MessageModal open={msgOpen} onOpenChange={setMsgOpen} client={client} />
    </div>
  );
}
