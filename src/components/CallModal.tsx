import { useEffect, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Pause } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Client } from "@/lib/mock-data";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  client: Client | null;
}

function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

export function CallModal({ open, onOpenChange, client }: Props) {
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [summary, setSummary] = useState("");

  useEffect(() => {
    if (!open) { setSeconds(0); setSummary(""); setMuted(false); return; }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [open]);

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-success animate-pulse-dot" />
            In-Call · {client.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-4 p-4 rounded-lg bg-gradient-surface border border-border">
          <div className="h-14 w-14 rounded-full flex items-center justify-center text-lg font-semibold text-white" style={{ background: client.avatarColor }}>
            {client.name.split(" ").map(n => n[0]).join("")}
          </div>
          <div className="flex-1">
            <div className="font-semibold">{client.name}</div>
            <div className="text-xs text-muted-foreground">{client.phone}</div>
            <div className="text-[10px] uppercase tracking-wider text-success mt-1">{client.tier} · Connected</div>
          </div>
          <div className="text-2xl font-mono tabular-nums text-success">{fmt(seconds)}</div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => setMuted(!muted)} className={`p-3 rounded-md border border-border transition-colors ${muted ? "bg-destructive/20 text-destructive" : "bg-surface-elevated hover:bg-accent"}`}>
            {muted ? <MicOff className="h-4 w-4 mx-auto" /> : <Mic className="h-4 w-4 mx-auto" />}
            <div className="text-[10px] mt-1">{muted ? "Muted" : "Mute"}</div>
          </button>
          <button className="p-3 rounded-md border border-border bg-surface-elevated hover:bg-accent">
            <Pause className="h-4 w-4 mx-auto" />
            <div className="text-[10px] mt-1">Hold</div>
          </button>
          <button className="p-3 rounded-md border border-border bg-surface-elevated hover:bg-accent">
            <Phone className="h-4 w-4 mx-auto" />
            <div className="text-[10px] mt-1">Keypad</div>
          </button>
        </div>

        <div>
          <div className="text-xs font-medium mb-1.5 text-muted-foreground">Client quick notes</div>
          <div className="text-xs p-3 rounded-md bg-surface border border-border text-muted-foreground">
            Tier: <span className="text-foreground">{client.tier}</span> · Portfolio: <span className="text-foreground">${(client.portfolioValue/1000).toFixed(0)}K</span><br/>
            Interests: <span className="text-foreground">{client.interests.join(", ")}</span>
          </div>
        </div>

        <div>
          <div className="text-xs font-medium mb-1.5 text-muted-foreground">Call summary</div>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Summarize discussion, action items, next steps…"
            className="min-h-[100px] bg-surface-elevated border-border resize-none"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Minimize</Button>
          <Button
            className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            onClick={() => {
              toast.success(`Call summary saved (${fmt(seconds)})`);
              onOpenChange(false);
            }}
          >
            <PhoneOff className="h-4 w-4" /> End & Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
