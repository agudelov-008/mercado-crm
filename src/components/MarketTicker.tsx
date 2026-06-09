import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";

/** Llave opcional para migrar a TwelveData/AlphaVantage en producción. */
const FINANCIAL_API_KEY = "";
const REFRESH_MS = 60_000;
const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple,dogecoin,pax-gold&vs_currencies=usd&include_24hr_change=true";

type TickerItem = {
  symbol: string;
  value: string;
  change: string;
  changePercent: number;
};

type CoinGeckoRow = {
  usd?: number;
  usd_24h_change?: number;
};

type YahooMeta = {
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  chartPreviousClose?: number;
  previousClose?: number;
};

const CRYPTO_ASSETS = [
  { id: "bitcoin", symbol: "BTC/USD", decimals: 0 },
  { id: "ethereum", symbol: "ETH/USD", decimals: 2 },
  { id: "solana", symbol: "SOL/USD", decimals: 2 },
  { id: "ripple", symbol: "XRP/USD", decimals: 4 },
  { id: "dogecoin", symbol: "DOGE/USD", decimals: 4 },
  { id: "pax-gold", symbol: "ORO (XAU/USD)", decimals: 2 },
] as const;

const YAHOO_ASSETS = [
  { ticker: "^DJI", symbol: "DOW JONES", decimals: 2 },
  { ticker: "^GSPC", symbol: "S&P 500", decimals: 2 },
  { ticker: "^IXIC", symbol: "NASDAQ", decimals: 2 },
  { ticker: "^RUT", symbol: "RUSSELL 2000", decimals: 2 },
  { ticker: "^VIX", symbol: "VIX", decimals: 2 },
  { ticker: "BZ=F", symbol: "PETRÓLEO BRENT", decimals: 2 },
] as const;

const DISPLAY_ORDER = [
  ...CRYPTO_ASSETS.map((asset) => asset.symbol),
  ...YAHOO_ASSETS.map((asset) => asset.symbol),
] as const;

function formatUsd(value: number, decimals = 2): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatPercent(change: number): string {
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

function formatLastUpdated(date: Date): string {
  return date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function normalizeChange(
  price: number | undefined,
  changePercent: number | undefined,
  previousClose: number | undefined,
): number | null {
  if (
    changePercent != null &&
    Number.isFinite(changePercent)
  ) {
    return changePercent;
  }

  if (
    price != null &&
    Number.isFinite(price) &&
    previousClose != null &&
    Number.isFinite(previousClose) &&
    previousClose > 0
  ) {
    return ((price - previousClose) / previousClose) * 100;
  }

  return null;
}

async function fetchCoinGeckoItems(): Promise<TickerItem[]> {
  const response = await fetch(COINGECKO_URL);
  if (!response.ok) throw new Error("CoinGecko request failed");
  const json = (await response.json()) as Record<string, CoinGeckoRow>;

  return CRYPTO_ASSETS.flatMap((asset) => {
    const row = json[asset.id];
    if (row?.usd == null || row.usd_24h_change == null) return [];

    return [
      {
        symbol: asset.symbol,
        value: formatUsd(row.usd, asset.decimals),
        change: formatPercent(row.usd_24h_change),
        changePercent: row.usd_24h_change,
      },
    ];
  });
}

async function fetchYahooChartMeta(ticker: string): Promise<YahooMeta | null> {
  const base = "https://api.allorigins.win/raw?url=";
  const targets = [
    `https://query1.financeapi.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`,
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`,
  ];

  for (const target of targets) {
    const endpoint = `${base}${encodeURIComponent(target)}`;
    try {
      const response = await fetch(endpoint);
      if (!response.ok) continue;
      const json = (await response.json()) as {
        chart?: { result?: { meta?: YahooMeta }[] };
      };
      const meta = json.chart?.result?.[0]?.meta;
      if (meta) return meta;
    } catch {
      /* try next target */
    }
  }

  if (FINANCIAL_API_KEY.trim()) {
    // Punto de extensión: migración a proveedor con API key.
  }

  return null;
}

async function fetchYahooItems(): Promise<TickerItem[]> {
  const metas = await Promise.all(
    YAHOO_ASSETS.map((asset) => fetchYahooChartMeta(asset.ticker)),
  );

  return metas.flatMap((meta, index) => {
    if (!meta) return [];

    const asset = YAHOO_ASSETS[index];
    const price = meta.regularMarketPrice;
    if (price == null || !Number.isFinite(price)) return [];

    const changePercent = normalizeChange(
      price,
      meta.regularMarketChangePercent,
      meta.chartPreviousClose ?? meta.previousClose,
    );
    if (changePercent == null) return [];

    const value =
      asset.symbol === "PETRÓLEO BRENT"
        ? formatUsd(price, asset.decimals)
        : price.toLocaleString("en-US", {
            minimumFractionDigits: asset.decimals,
            maximumFractionDigits: asset.decimals,
          });

    return [
      {
        symbol: asset.symbol,
        value,
        change: formatPercent(changePercent),
        changePercent,
      },
    ];
  });
}

function TickerSegment({ item }: { item: TickerItem }) {
  const up = item.changePercent >= 0;

  return (
    <div
      className="flex shrink-0 items-center gap-2 px-6 text-xs tabular-nums"
      aria-label={`${item.symbol} ${item.value} ${item.change}`}
    >
      <span className="font-semibold tracking-wide text-white/90">{item.symbol}</span>
      <span className="text-white/60">{item.value}</span>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold",
          up ? "text-emerald-400 bg-emerald-500/15" : "text-rose-300 bg-rose-400/15",
        )}
      >
        <span aria-hidden className="text-[10px] leading-none">
          {up ? "▲" : "▼"}
        </span>
        {item.change}
      </span>
      <span className="text-white/15" aria-hidden>
        |
      </span>
    </div>
  );
}

function TickerSkeleton() {
  return (
    <div className="group relative overflow-hidden border-b border-white/[0.06] bg-[#0b0b0b]">
      <div className="flex w-full items-center gap-3 overflow-hidden px-6 py-2.5">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={`ticker-skeleton-${index}`}
            className="h-4 w-28 animate-pulse rounded bg-white/10"
          />
        ))}
      </div>
    </div>
  );
}

export function MarketTicker() {
  const { profileRole } = useApp();
  const isAffiliate = profileRole === "Affiliate";
  const [items, setItems] = useState<TickerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    const [cryptoResult, yahooResult] = await Promise.allSettled([
      fetchCoinGeckoItems(),
      fetchYahooItems(),
    ]);

    setItems((prev) => {
      const merged = new Map(prev.map((item) => [item.symbol, item]));

      if (cryptoResult.status === "fulfilled") {
        for (const item of cryptoResult.value) merged.set(item.symbol, item);
      }
      if (yahooResult.status === "fulfilled") {
        for (const item of yahooResult.value) merged.set(item.symbol, item);
      }

      return DISPLAY_ORDER.map((symbol) => merged.get(symbol)).filter(
        (item): item is TickerItem => item != null,
      );
    });

    const hasFreshData =
      (cryptoResult.status === "fulfilled" && cryptoResult.value.length > 0) ||
      (yahooResult.status === "fulfilled" && yahooResult.value.length > 0);
    if (hasFreshData) {
      setLastUpdatedAt(new Date());
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isAffiliate) return;

    void refresh();
    const intervalId = window.setInterval(() => {
      void refresh();
    }, REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, [isAffiliate, refresh]);

  const loop = useMemo(() => [...items, ...items], [items]);

  if (isAffiliate) return null;
  if (isLoading && items.length === 0) return <TickerSkeleton />;
  if (items.length === 0) return <TickerSkeleton />;

  return (
    <div
      className="group relative overflow-hidden border-b border-white/[0.06] bg-[#0b0b0b]"
      role="region"
      aria-label="Ticker financiero Five Elements"
    >
      <div className="pointer-events-none absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-md border border-white/10 bg-black/70 px-2 py-1 text-[10px] text-white/65 backdrop-blur">
        <span
          className={cn(
            "mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle",
            lastUpdatedAt ? "bg-emerald-400" : "animate-pulse bg-amber-300",
          )}
        />
        {lastUpdatedAt
          ? `Actualizado ${formatLastUpdated(lastUpdatedAt)}`
          : "Actualizando..."}
      </div>
      <div className="market-ticker-track flex w-max py-2.5">
        {loop.map((item, index) => (
          <TickerSegment key={`${item.symbol}-${index}`} item={item} />
        ))}
      </div>
    </div>
  );
}
