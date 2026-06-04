import { useState } from "react";
import { MessageSquare, Mail, FileBarChart, Send } from "lucide-react";
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

const templates = [
  {
    id: "wa-checkin",
    label: "WhatsApp Check-in",
    channel: "WhatsApp",
    icon: MessageSquare,
    body: (c: string) => `Hola ${c}, espero que estés muy bien. Te escribo para coordinar una breve revisión de tu portafolio esta semana. ¿Tienes 15 minutos disponibles?\n\nSaludos,\nFive Elements`,
  },
  {
    id: "email-report",
    label: "Market Report Email",
    channel: "Email",
    icon: FileBarChart,
    body: (c: string) => `Estimado/a ${c},\n\nAdjunto encontrarás nuestro reporte mensual de mercado con el desempeño de tu portafolio y recomendaciones de rebalanceo.\n\nPuntos destacados:\n• Rendimiento YTD: +8.4%\n• Sectores con sobreponderación sugerida\n• Oportunidades en mercados emergentes\n\nQuedo atento a tus comentarios.\n\nAtentamente,\nEquipo Five Elements`,
  },
  {
    id: "email-rebalance",
    label: "Rebalancing Proposal",
    channel: "Email",
    icon: Mail,
    body: (c: string) => `Estimado/a ${c},\n\nBasado en la última revisión de tu perfil de riesgo, te enviamos una propuesta de rebalanceo:\n\n- Renta Variable: 65% (actual 58%)\n- Renta Fija: 25% (actual 32%)\n- Alternativos: 10% (actual 10%)\n\n¿Podemos agendar una llamada para discutir?\n\nSaludos cordiales.`,
  },
  {
    id: "wa-kyc",
    label: "KYC Reminder",
    channel: "WhatsApp",
    icon: MessageSquare,
    body: (c: string) => `Hola ${c}, te recordamos que tu documentación KYC vence próximamente. Por favor envíanos los documentos actualizados para mantener tu cuenta activa. ¡Gracias!`,
  },
];

export function MessageModal({ open, onOpenChange, client }: Props) {
  const [selected, setSelected] = useState(templates[0].id);
  const tpl = templates.find(t => t.id === selected)!;
  const [body, setBody] = useState(client ? tpl.body(client.name.split(" ")[0]) : "");

  function pick(id: string) {
    setSelected(id);
    const t = templates.find(t => t.id === id)!;
    setBody(client ? t.body(client.name.split(" ")[0]) : "");
  }

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle>Send message to {client.name}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-[200px_1fr] gap-4">
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Templates</div>
            {templates.map((t) => {
              const Icon = t.icon;
              const active = selected === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => pick(t.id)}
                  className={`w-full text-left p-2.5 rounded-md border transition-all ${
                    active
                      ? "bg-primary/15 border-primary/40 shadow-glow"
                      : "bg-surface-elevated border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <Icon className="h-3.5 w-3.5" /> {t.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{t.channel}</div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Sending via</span>
              <span className="px-2 py-0.5 rounded bg-info/20 text-info font-medium">{tpl.channel}</span>
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[280px] bg-surface-elevated border-border resize-none text-sm leading-relaxed"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                className="flex-1 bg-gradient-primary shadow-glow"
                onClick={() => {
                  toast.success(`Message sent to ${client.name}`);
                  onOpenChange(false);
                }}
              >
                <Send className="h-4 w-4" /> Send {tpl.channel}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
