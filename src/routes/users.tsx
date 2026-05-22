import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Shield, Plus, Mail, Briefcase, MoreHorizontal, Lock } from "lucide-react";
import { agents as seed, formatCurrency, type Agent } from "@/lib/mock-data";
import { useApp } from "@/lib/app-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export const Route = createFileRoute("/users")({ component: UsersPage });

const permList = [
  "View all clients",
  "Edit client portfolios",
  "Send messages",
  "Approve trades > $100K",
  "Manage compliance docs",
  "View analytics",
];

function UsersPage() {
  const { role } = useApp();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>(seed);
  const [open, setOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [perms, setPerms] = useState<Record<string, boolean>>({});

  if (role !== "Administrator") {
    return (
      <div className="p-8 max-w-md mx-auto mt-20 text-center">
        <Lock className="h-10 w-10 mx-auto text-muted-foreground" />
        <h2 className="text-xl font-semibold mt-4">Administrator access required</h2>
        <p className="text-sm text-muted-foreground mt-2">Switch role from the top bar to preview this view.</p>
        <Button className="mt-4" onClick={() => navigate({ to: "/" })}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> User Management</h1>
          <p className="text-sm text-muted-foreground">{agents.length} team members · {agents.filter(a => a.status === "Active").length} active</p>
        </div>
        <button onClick={() => setOpen(true)} className="h-10 px-4 rounded-md bg-gradient-primary text-primary-foreground text-sm font-medium flex items-center gap-2 shadow-glow">
          <Plus className="h-4 w-4" /> Add New Agent
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-elevated/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Agent</th>
              <th className="text-left px-4 py-3 font-medium">Role</th>
              <th className="text-right px-4 py-3 font-medium">Clients</th>
              <th className="text-right px-4 py-3 font-medium">AUM</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {agents.map(a => (
              <tr key={a.id} className="border-t border-border hover:bg-surface-elevated/40 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
                      {a.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div>
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{a.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${a.role === "Administrator" ? "bg-warning/15 text-warning border-warning/30" : "bg-info/15 text-info border-info/30"}`}>{a.role}</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{a.clients}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(a.aum)}</td>
                <td className="px-4 py-3">
                  <span className={`flex items-center gap-1.5 text-xs ${a.status === "Active" ? "text-success" : "text-muted-foreground"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${a.status === "Active" ? "bg-success animate-pulse-dot" : "bg-muted-foreground"}`} />
                    {a.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setEditAgent(a); setPerms(Object.fromEntries(permList.map(p => [p, Math.random() > 0.3]))); }} className="text-xs px-2.5 py-1 rounded-md border border-border hover:border-primary/40 hover:text-primary transition-colors">Edit permissions</button>
                    <button className="h-7 w-7 rounded-md hover:bg-surface-elevated flex items-center justify-center"><MoreHorizontal className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add agent modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary" /> Add New Agent</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); const form = new FormData(e.currentTarget as HTMLFormElement); const name = String(form.get("name") || ""); const email = String(form.get("email") || ""); const role = String(form.get("role") || "Agent") as Agent["role"]; setAgents(a => [...a, { id: `a${a.length + 1}`, name, email, role, clients: 0, aum: 0, status: "Active" }]); toast.success(`${name} added to the team`); setOpen(false); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" name="name" required placeholder="e.g. Andrea Velasco" className="bg-surface-elevated border-border" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Work email</Label>
                <Input id="email" name="email" required type="email" placeholder="andrea@quantcapital.io" className="bg-surface-elevated border-border" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select name="role" defaultValue="Agent">
                  <SelectTrigger className="bg-surface-elevated border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Agent">Agent</SelectItem>
                    <SelectItem value="Administrator">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Specialization</Label>
                <Select defaultValue="equities">
                  <SelectTrigger className="bg-surface-elevated border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equities">Equities</SelectItem>
                    <SelectItem value="fixed">Fixed Income</SelectItem>
                    <SelectItem value="alt">Alternatives</SelectItem>
                    <SelectItem value="wealth">Wealth Planning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Default permissions</Label>
              <div className="rounded-md border border-border bg-surface-elevated p-3 space-y-2">
                {permList.slice(0, 4).map(p => (
                  <label key={p} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox defaultChecked={p !== "Approve trades > $100K"} /> {p}
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-gradient-primary shadow-glow">Create agent</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit permissions modal */}
      <Dialog open={!!editAgent} onOpenChange={(o) => !o && setEditAgent(null)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Permissions · {editAgent?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 rounded-md border border-border bg-surface-elevated p-3">
            {permList.map(p => (
              <label key={p} className="flex items-center justify-between gap-2 text-sm cursor-pointer py-1">
                <span>{p}</span>
                <Checkbox checked={!!perms[p]} onCheckedChange={(v) => setPerms(prev => ({ ...prev, [p]: !!v }))} />
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAgent(null)}>Cancel</Button>
            <Button className="bg-gradient-primary shadow-glow" onClick={() => { toast.success(`Permissions updated for ${editAgent?.name}`); setEditAgent(null); }}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
