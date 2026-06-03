import { Phone } from "lucide-react";
import type { Client } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/mock-data";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

const tierStyles: Record<string, string> = {
  Conservative: "bg-info/15 text-info border-info/30",
  Moderate: "bg-warning/15 text-warning border-warning/30",
  Aggressive: "bg-destructive/15 text-destructive border-destructive/30",
};

interface Props {
  client: Client;
  onCall: () => void;
  onMessage: () => void;
  onOpen: () => void;
  /** Solo Agent ve el botón de WhatsApp; otros roles lo ocultan. */
  showMessageButton?: boolean;
}

export function ClientCard({
  client,
  onCall,
  onMessage,
  onOpen,
  showMessageButton = true,
}: Props) {
  const progress = Math.min(100, (client.portfolioValue / client.targetInvestment) * 100);
  return (
    <div className="group rounded-xl border border-border bg-gradient-surface p-4 hover:border-primary/40 hover:shadow-elegant transition-all animate-fade-in-up">
      <div className="flex items-center gap-4">
        <button onClick={onOpen} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <div
            className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0"
            style={{ background: client.avatarColor }}
          >
            {client.name.split(" ").map(n => n[0]).join("")}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold truncate">{client.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${tierStyles[client.tier]}`}>
                {client.tier}
              </span>
            </div>
            <div className="text-xs text-muted-foreground truncate">
              Last contact · {client.lastContact} · {client.assignedAgent}
            </div>
          </div>
        </button>

        <div className="hidden lg:block min-w-[180px]">
          <div className="flex justify-between text-xs mb-1 tabular-nums">
            <span className="text-foreground font-medium">{formatCurrency(client.portfolioValue)}</span>
            <span className="text-muted-foreground">of {formatCurrency(client.targetInvestment)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-elevated overflow-hidden">
            <div className="h-full bg-gradient-success" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={onCall}
            className="h-10 px-4 rounded-md bg-success/15 hover:bg-success/25 text-success border border-success/30 transition-all flex items-center gap-2 text-sm font-medium hover:shadow-[0_0_20px_oklch(0.68_0.17_155_/_0.3)]"
          >
            <Phone className="h-4 w-4" /> Llamar
          </button>
          {showMessageButton && (
            <button
              type="button"
              onClick={onMessage}
              className="h-10 px-4 rounded-md bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#25D366] border border-[#25D366]/35 transition-all flex items-center gap-2 text-sm font-medium hover:shadow-[0_0_20px_rgba(37,211,102,0.28)]"
              aria-label="Abrir WhatsApp"
            >
              <WhatsAppIcon className="h-4 w-4" /> WhatsApp
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
