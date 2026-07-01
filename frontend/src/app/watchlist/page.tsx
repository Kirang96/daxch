"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Bot, Plus, Trash2 } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge, Disclaimer, GlassCard, Sparkline, AlertBanner } from "@/components/daxch/primitives";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { WatchlistItem } from "@/types";

type QuoteData = { ltp: number; change_percent: number | null };
type ItemMarketData = {
  quote: QuoteData | null;
  candles: number[];
};

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [marketData, setMarketData] = useState<Record<string, ItemMarketData>>({});
  const [ticker, setTicker] = useState("");
  const [exchange, setExchange] = useState("NSE");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadMarketData = async (watchlistItems: WatchlistItem[]) => {
    const entries = await Promise.all(
      watchlistItems.map(async (item) => {
        const key = item.id;
        try {
          const [quote, candles] = await Promise.all([
            api.get<{ ltp: number; change_percent: number | null }>(
              `/stocks/quote/${item.ticker}?exchange=${item.exchange}`
            ),
            api.get<{ prices: number[] }>(`/stocks/candles/${item.ticker}?exchange=${item.exchange}`)
          ]);
          if (candles.prices.length === 0) {
            logger.warn("No candle data for watchlist item", { page: "watchlist", ticker: item.ticker });
          }
          return [key, { quote, candles: candles.prices }] as const;
        } catch (err) {
          logger.warn("Failed to load market data for watchlist item", {
            page: "watchlist",
            ticker: item.ticker,
            message: (err as Error).message
          });
          return [key, { quote: null, candles: [] }] as const;
        }
      })
    );
    setMarketData(Object.fromEntries(entries));
  };

  const refresh = async () => {
    try {
      setLoading(true);
      const data = await api.get<WatchlistItem[]>("/watchlist");
      setItems(data);
      if (data.length > 0) {
        await loadMarketData(data);
      } else {
        setMarketData({});
      }
    } catch (err) {
      logger.error("Failed to load watchlist", { page: "watchlist", message: (err as Error).message });
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const addItem = async () => {
    if (!ticker.trim()) {
      return;
    }
    try {
      setError("");
      await api.post("/watchlist", { ticker: ticker.toUpperCase(), exchange });
      setTicker("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const removeItem = async (id: string) => {
    try {
      setError("");
      await api.del(`/watchlist/${id}`);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const cardData = useMemo(
    () =>
      items.map((item) => {
        const data = marketData[item.id];
        return {
          ...item,
          ltp: data?.quote?.ltp ?? null,
          delta: data?.quote?.change_percent ?? null,
          candles: data?.candles ?? []
        };
      }),
    [items, marketData]
  );

  return (
    <AppShell
      title="Watchlist"
      subtitle="Track ideas before promoting them to active monitoring agents."
      actions={
        <button onClick={addItem} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm hover:bg-white/[0.06]">
          <Plus className="h-4 w-4" /> Add symbol
        </button>
      }
    >
      {error && <AlertBanner variant="error" className="mb-4">{error}</AlertBanner>}
      <GlassCard className="mb-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_auto]">
          <input
            value={ticker}
            onChange={(event) => setTicker(event.target.value.toUpperCase())}
            placeholder="Ticker"
            className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <select
            value={exchange}
            onChange={(event) => setExchange(event.target.value)}
            className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="NSE">NSE</option>
            <option value="BSE">BSE</option>
          </select>
          <button onClick={addItem} className="rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground">
            Save
          </button>
        </div>
      </GlassCard>

      {loading && items.length === 0 && (
        <GlassCard className="mb-4">
          <p className="text-sm text-muted-foreground">Loading watchlist…</p>
        </GlassCard>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cardData.map((item) => {
          const up = (item.delta ?? 0) >= 0;
          return (
            <GlassCard key={item.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{item.ticker}</div>
                  <div className="mt-1 truncate text-sm font-medium">{item.exchange}</div>
                </div>
                <button
                  onClick={() => removeItem(item.id)}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {item.candles.length >= 2 ? (
                <Sparkline
                  data={item.candles}
                  color={up ? "oklch(var(--success))" : "oklch(var(--destructive))"}
                  className="mt-5"
                  height={58}
                />
              ) : (
                <p className="mt-5 py-6 text-center text-xs text-muted-foreground">Chart unavailable</p>
              )}

              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Current price</div>
                  <div className="text-lg font-semibold tabular-nums">
                    {item.ltp != null ? `₹${item.ltp.toFixed(2)}` : "Unavailable"}
                  </div>
                </div>
                {item.delta != null ? (
                  <Badge variant={up ? "success" : "danger"}>
                    {item.delta > 0 ? "+" : ""}
                    {item.delta.toFixed(2)}%
                  </Badge>
                ) : (
                  <Badge variant="neutral">—</Badge>
                )}
              </div>

              <Link
                href={`/agents/new?ticker=${item.ticker}`}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:brightness-110"
              >
                <Bot className="h-4 w-4" /> Promote to agent
              </Link>
            </GlassCard>
          );
        })}
      </div>
      {!loading && items.length === 0 && (
        <GlassCard className="mt-4">
          <p className="text-sm text-muted-foreground">No watchlist symbols yet.</p>
        </GlassCard>
      )}

      <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Tip:</span> Promote watchlist symbols to active agents only when you
        have a clear thesis and position sizing plan.
        <Link href="/research" className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">
          Open research center <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-8">
        <Disclaimer />
      </div>
    </AppShell>
  );
}
