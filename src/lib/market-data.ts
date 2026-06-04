export interface MarketTickerItem {
  symbol: string;
  value: string;
  change: string;
  up: boolean;
}

const CACHE_KEY = "mercado-crm-market-ticker-cache";

type CachedSnapshot = {
  btcUsd?: number;
  btcChange24h?: number;
  mxnPerUsd?: number;
  goldUsdPerOz?: number;
  updatedAt: string;
};

function readCache(): CachedSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedSnapshot;
  } catch {
    return null;
  }
}

function writeCache(snapshot: CachedSnapshot): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore quota errors */
  }
}

function formatUsd(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatPercent(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

function percentChange(current: number, previous: number | undefined): number {
  if (previous === undefined || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

async function fetchBitcoin(): Promise<{ price: number; change24h: number } | null> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true",
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    bitcoin?: { usd?: number; usd_24h_change?: number };
  };
  const btc = json.bitcoin;
  if (btc?.usd == null) return null;
  return {
    price: btc.usd,
    change24h: btc.usd_24h_change ?? 0,
  };
}

async function fetchUsdRates(): Promise<{
  mxnPerUsd: number;
  goldUsdPerOz: number | null;
} | null> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) return null;
  const json = (await res.json()) as {
    result?: string;
    rates?: Record<string, number>;
  };
  if (json.result !== "success" || !json.rates) return null;

  const mxn = json.rates.MXN;
  if (mxn == null || mxn <= 0) return null;

  const xauPerUsd = json.rates.XAU;
  const goldUsdPerOz =
    xauPerUsd != null && xauPerUsd > 0 ? 1 / xauPerUsd : null;

  return { mxnPerUsd: mxn, goldUsdPerOz };
}

const FALLBACK_ITEMS: MarketTickerItem[] = [
  { symbol: "BTC/USD", value: "$—", change: "0.00%", up: true },
  { symbol: "USD/MXN", value: "—", change: "0.00%", up: true },
  { symbol: "GOLD (XAU)", value: "$—", change: "0.00%", up: true },
];

export async function fetchMarketTickerItems(): Promise<MarketTickerItem[]> {
  const cache = readCache();
  const items: MarketTickerItem[] = [];

  let btcUsd = cache?.btcUsd;
  let btcChange24h = cache?.btcChange24h;
  let mxnPerUsd = cache?.mxnPerUsd;
  let goldUsdPerOz = cache?.goldUsdPerOz;

  const [btcResult, ratesResult] = await Promise.allSettled([
    fetchBitcoin(),
    fetchUsdRates(),
  ]);

  if (btcResult.status === "fulfilled" && btcResult.value) {
    btcUsd = btcResult.value.price;
    btcChange24h = btcResult.value.change24h;
  }

  if (ratesResult.status === "fulfilled" && ratesResult.value) {
    mxnPerUsd = ratesResult.value.mxnPerUsd;
    if (ratesResult.value.goldUsdPerOz != null) {
      goldUsdPerOz = ratesResult.value.goldUsdPerOz;
    }
  }

  const nextCache: CachedSnapshot = {
    btcUsd,
    btcChange24h,
    mxnPerUsd,
    goldUsdPerOz: goldUsdPerOz ?? undefined,
    updatedAt: new Date().toISOString(),
  };
  writeCache(nextCache);

  if (btcUsd != null) {
    const change = btcChange24h ?? 0;
    items.push({
      symbol: "BTC/USD",
      value: formatUsd(btcUsd, btcUsd >= 1000 ? 0 : 2),
      change: formatPercent(change),
      up: change >= 0,
    });
  }

  if (mxnPerUsd != null) {
    const mxnChange = percentChange(mxnPerUsd, cache?.mxnPerUsd);
    items.push({
      symbol: "USD/MXN",
      value: mxnPerUsd.toFixed(4),
      change: formatPercent(mxnChange),
      up: mxnChange >= 0,
    });
  }

  if (goldUsdPerOz != null) {
    const goldChange = percentChange(goldUsdPerOz, cache?.goldUsdPerOz);
    items.push({
      symbol: "GOLD (XAU)",
      value: formatUsd(goldUsdPerOz, 2),
      change: formatPercent(goldChange),
      up: goldChange >= 0,
    });
  }

  if (items.length === 0 && cache) {
    if (cache.btcUsd != null) {
      const change = cache.btcChange24h ?? 0;
      items.push({
        symbol: "BTC/USD",
        value: formatUsd(cache.btcUsd, cache.btcUsd >= 1000 ? 0 : 2),
        change: formatPercent(change),
        up: change >= 0,
      });
    }
    if (cache.mxnPerUsd != null) {
      items.push({
        symbol: "USD/MXN",
        value: cache.mxnPerUsd.toFixed(4),
        change: "0.00%",
        up: true,
      });
    }
    if (cache.goldUsdPerOz != null) {
      items.push({
        symbol: "GOLD (XAU)",
        value: formatUsd(cache.goldUsdPerOz, 2),
        change: "0.00%",
        up: true,
      });
    }
  }

  if (items.length === 0) {
    return FALLBACK_ITEMS;
  }

  return items;
}
