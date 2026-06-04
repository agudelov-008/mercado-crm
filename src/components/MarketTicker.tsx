import { useQuery } from "@tanstack/react-query";
import { TrendingDown, TrendingUp } from "lucide-react";
import { fetchMarketTickerItems } from "@/lib/market-data";
import { cn } from "@/lib/utils";

const MARKET_TICKER_QUERY_KEY = ["market-ticker"] as const;

export function MarketTicker() {
  const { data: items = [] } = useQuery({
    queryKey: MARKET_TICKER_QUERY_KEY,
    queryFn: fetchMarketTickerItems,
    staleTime: 1000 * 60 * 30,
    refetchInterval: 1000 * 60 * 30,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  const loop = [...items, ...items];

  return (
    <div className="border-b border-border bg-surface/80 backdrop-blur overflow-hidden">
      <div className="flex animate-ticker whitespace-nowrap py-2">
        {loop.map((t, i) => (
          <div
            key={`${t.symbol}-${i}`}
            className="flex items-center gap-2 px-6 text-xs tabular-nums"
          >
            <span className="font-semibold text-foreground/90">{t.symbol}</span>
            <span className="text-muted-foreground">{t.value}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 font-medium rounded px-1.5 py-0.5",
                t.up
                  ? "text-success bg-success/15"
                  : "text-destructive bg-destructive/15",
              )}
            >
              {t.up ? (
                <TrendingUp className="h-3 w-3" aria-hidden />
              ) : (
                <TrendingDown className="h-3 w-3" aria-hidden />
              )}
              <span aria-hidden>{t.up ? "▲" : "▼"}</span>
              {t.change}
            </span>
            <span className="text-border">|</span>
          </div>
        ))}
      </div>
    </div>
  );
}
