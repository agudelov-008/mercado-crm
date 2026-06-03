import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  label: string;
  value: string;
  delta?: string;
  up?: boolean;
  icon: LucideIcon;
  accent?: "primary" | "success" | "warning" | "info";
}

const accentMap = {
  primary: "from-primary/30 to-primary/5 text-primary",
  success: "from-success/30 to-success/5 text-success",
  warning: "from-warning/30 to-warning/5 text-warning",
  info: "from-info/30 to-info/5 text-info",
};

export function MetricCard({ label, value, delta, up, icon: Icon, accent = "primary" }: Props) {
  return (
    <div className="relative rounded-xl border border-border bg-gradient-surface p-5 overflow-hidden hover:border-primary/40 hover:shadow-elegant transition-all">
      <div className={`absolute -top-8 -right-8 h-28 w-28 rounded-full bg-gradient-to-br ${accentMap[accent]} blur-2xl opacity-60`} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-3xl font-semibold mt-2 tabular-nums">{value}</div>
          {delta && (
            <div
              className={`flex items-center gap-1 text-xs mt-2 font-medium ${
                up === undefined
                  ? "text-muted-foreground"
                  : up
                    ? "text-success"
                    : "text-destructive"
              }`}
            >
              {up === true && <TrendingUp className="h-3 w-3" />}
              {up === false && <TrendingDown className="h-3 w-3" />}
              {delta}
            </div>
          )}
        </div>
        <div className={`h-10 w-10 rounded-lg bg-surface-elevated border border-border flex items-center justify-center ${accentMap[accent].split(" ").pop()}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
