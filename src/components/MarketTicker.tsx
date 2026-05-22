import { TrendingUp, TrendingDown } from "lucide-react";
import { marketTicker } from "@/lib/mock-data";

export function MarketTicker() {
  const items = [...marketTicker, ...marketTicker];
  return (
    <div className="border-b border-border bg-surface/80 backdrop-blur overflow-hidden">
      <div className="flex animate-ticker whitespace-nowrap py-2">
        {items.map((t, i) => (
          <div key={i} className="flex items-center gap-2 px-6 text-xs tabular-nums">
            <span className="font-semibold text-foreground/90">{t.symbol}</span>
            <span className="text-muted-foreground">{t.value}</span>
            <span className={`flex items-center gap-1 font-medium ${t.up ? "text-success" : "text-destructive"}`}>
              {t.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {t.change}
            </span>
            <span className="text-border">|</span>
          </div>
        ))}
      </div>
    </div>
  );
}
