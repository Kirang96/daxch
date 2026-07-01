"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, Clock } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge, ChartCardHeader, Disclaimer, GlassCard, Sparkline, StatCard, AlertBanner, TimeframeTabs } from "@/components/daxch/primitives";
import { api } from "@/lib/api";
import { sliceByTimeframe } from "@/lib/chart";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { ExchangePositionsResponse, MonitorAgent, StockHolding } from "@/types";

const TIMEFRAME_OPTIONS = ["1D", "1W", "1M", "3M", "1Y", "All"] as const;
type ChartTimeframe = (typeof TIMEFRAME_OPTIONS)[number];

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<StockHolding[]>([]);
  const [agents, setAgents] = useState<MonitorAgent[]>([]);
  const [positionsByHolding, setPositionsByHolding] = useState<Record<string, ExchangePositionsResponse["positions"][0]>>({});
  const [exchangeSummary, setExchangeSummary] = useState<ExchangePositionsResponse["summary"] | null>(null);
  const [quotes, setQuotes] = useState<Record<string, { ltp: number; change_percent: number | null }>>({});
  const [portfolioHistory, setPortfolioHistory] = useState<number[]>([]);
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("1M");
  const [error, setError] = useState("");

  const displayChartData = useMemo(() => sliceByTimeframe(portfolioHistory, timeframe), [portfolioHistory, timeframe]);

  const hasExchangePnl = Boolean(exchangeSummary?.has_exchange_positions);

  const sectorExposure = useMemo(() => {
    if (!hasExchangePnl) return [];
    const totals: Record<string, number> = {};
    let grandTotal = 0;
    holdings.forEach((holding) => {
      const pos = positionsByHolding[holding.id];
      if (!pos?.has_exchange_position || pos.market_value == null) return;
      const sec = holding.sector || "Other";
      totals[sec] = (totals[sec] || 0) + pos.market_value;
      grandTotal += pos.market_value;
    });

    const entries = Object.entries(totals).map(([sector, value]) => {
      const pct = grandTotal > 0 ? Math.round((value / grandTotal) * 100) : 0;
      return [sector, pct] as const;
    });
    entries.sort((a, b) => b[1] - a[1]);
    return entries;
  }, [holdings, positionsByHolding, hasExchangePnl]);

  useEffect(() => {
    const load = async () => {
      try {
        const [holdingData, agentData, positionsRes] = await Promise.all([
          api.get<StockHolding[]>("/stocks"),
          api.get<MonitorAgent[]>("/agents"),
          api.get<ExchangePositionsResponse>("/stocks/positions"),
        ]);
        setHoldings(holdingData);
        setAgents(agentData);
        setExchangeSummary(positionsRes.summary);
        setPositionsByHolding(Object.fromEntries(positionsRes.positions.map((p) => [p.holding_id, p])));

        const quoteEntries = await Promise.all(
          holdingData.map(async (holding) => {
            const key = `${holding.ticker}:${holding.exchange}`;
            try {
              const quote = await api.get<{ ltp: number; change_percent: number | null }>(
                `/stocks/quote/${holding.ticker}?exchange=${holding.exchange}`
              );
              return [key, quote] as const;
            } catch (err) {
              logger.warn("Quote unavailable for holding", {
                page: "portfolio",
                ticker: holding.ticker,
                message: (err as Error).message
              });
              return [key, null] as const;
            }
          })
        );
        setQuotes(
          Object.fromEntries(
            quoteEntries.filter((entry): entry is [string, { ltp: number; change_percent: number | null }] => entry[1] !== null)
          )
        );

        const activePositions = positionsRes.positions.filter((p) => p.has_exchange_position && p.net_quantity > 0);
        if (activePositions.length > 0) {
          try {
            const histories = await Promise.all(
              activePositions.map(async (pos) => {
                try {
                  const res = await api.get<{ prices: number[] }>(
                    `/stocks/candles/${pos.ticker}?exchange=${pos.exchange}`
                  );
                  return res.prices.map((p) => p * pos.net_quantity);
                } catch (err) {
                  logger.warn("Candle data unavailable", { page: "portfolio", ticker: pos.ticker, message: (err as Error).message });
                  return [] as number[];
                }
              })
            );
            const validHistories = histories.filter((series) => series.length > 0);
            if (validHistories.length === 0) {
              setPortfolioHistory([]);
            } else {
              const length = Math.max(...validHistories.map((h) => h.length));
              const totalSeries = Array(length).fill(0);
              validHistories.forEach((series) => {
                const offset = length - series.length;
                series.forEach((val, idx) => {
                  totalSeries[offset + idx] += val;
                });
              });
              setPortfolioHistory(totalSeries);
            }
          } catch (err) {
            logger.error("Failed to build portfolio chart", { page: "portfolio", message: (err as Error).message });
            setPortfolioHistory([]);
          }
        } else {
          setPortfolioHistory([]);
        }
      } catch (err) {
        logger.error("Failed to load portfolio", { page: "portfolio", message: (err as Error).message });
        setError((err as Error).message);
      }
    };
    load();
  }, []);

  const pnl = exchangeSummary?.unrealized_pnl ?? 0;
  const pnlPct = exchangeSummary?.unrealized_pnl_pct ?? 0;
  const currentValue = exchangeSummary?.market_value ?? 0;
  const invested = exchangeSummary?.invested ?? 0;
  const agentsByHolding = Object.fromEntries(agents.map((agent) => [agent.holding_id, agent]));

  return (
    <AppShell title="Portfolio" subtitle="Stocks you're monitoring with agents.">
      {error && <AlertBanner variant="error" className="mb-4">{error}</AlertBanner>}

      <AlertBanner variant="info" className="mb-6" title="Planned vs exchange">
        Entry and quantity are for AI analysis. P/L comes from filled exchange orders only — not manual Demat trades.
      </AlertBanner>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Exchange invested"
          value={hasExchangePnl ? `₹${invested.toFixed(2)}` : "—"}
          hint={hasExchangePnl ? "from filled orders" : "no fills yet"}
        />
        <StatCard
          label="Exchange value"
          value={hasExchangePnl ? `₹${currentValue.toFixed(2)}` : "—"}
          delta={hasExchangePnl ? `${pnlPct > 0 ? "+" : ""}${pnlPct.toFixed(2)}%` : undefined}
          trend={hasExchangePnl ? (pnl >= 0 ? "up" : "down") : "flat"}
          hint="filled qty × market price"
        />
        <StatCard
          label="Unrealized P/L"
          value={hasExchangePnl ? `${pnl > 0 ? "+" : ""}₹${pnl.toFixed(2)}` : "—"}
          delta={hasExchangePnl ? `${pnlPct > 0 ? "+" : ""}${pnlPct.toFixed(2)}%` : undefined}
          trend={hasExchangePnl ? (pnl >= 0 ? "up" : "down") : "flat"}
          hint="Daxch-approved fills only"
        />
        <StatCard
          label="Diversification"
          value={`${new Set(holdings.map((holding) => holding.exchange)).size} exchanges`}
          hint={`Active agents: ${agents.length}`}
        />
      </div>

      <GlassCard className="mt-6 overflow-hidden p-0">
        {/* Desktop table */}
        <div className="hidden md:block">
          <div className="grid grid-cols-[1.5fr_repeat(5,minmax(0,1fr))_auto] gap-4 border-b border-white/5 px-6 py-3 text-[11px] uppercase tracking-wider text-muted-foreground">
            <span>Stock</span>
            <span>Plan qty</span>
            <span>Entry / Market</span>
            <span>Exchange value</span>
            <span>P/L</span>
            <span>Agent</span>
            <span>Next</span>
          </div>
          {holdings.map((holding) => {
            const quote = quotes[`${holding.ticker}:${holding.exchange}`];
            const ltp = quote?.ltp ?? null;
            const pos = positionsByHolding[holding.id];
            const pnlRow = pos?.has_exchange_position ? pos.unrealized_pnl_pct : null;
            const up = (pnlRow ?? 0) >= 0;
            const linkedAgent = agentsByHolding[holding.id];
            return (
              <Link
                key={holding.id}
                href={linkedAgent ? `/agents/${linkedAgent.id}#exchange-trades` : "/agents"}
                className="grid grid-cols-[1.5fr_repeat(5,minmax(0,1fr))_auto] items-center gap-4 border-b border-white/5 px-6 py-4 text-sm hover:bg-white/[0.02]"
              >
                <div className="min-w-0">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{holding.ticker}</div>
                  <div className="truncate font-medium">{holding.exchange}</div>
                </div>
                <span title="Planned quantity for AI">{holding.quantity}</span>
                <div className="text-xs">
                  <div title="Planned entry">₹{holding.entry_price.toFixed(2)}</div>
                  <div className="text-muted-foreground" title="Live market price">{ltp != null ? `₹${ltp.toFixed(2)}` : "—"}</div>
                </div>
                <span>{pos?.has_exchange_position && pos.market_value != null ? `₹${pos.market_value.toLocaleString("en-IN")}` : "—"}</span>
                <span className={pnlRow != null ? (up ? "text-emerald-400" : "text-red-400") : "text-muted-foreground"}>
                  {pnlRow != null ? `${up ? "+" : ""}${pnlRow}%` : "—"}
                </span>
                <div className="flex items-center gap-2">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                  <Badge variant={linkedAgent?.status === "active" ? "success" : "warning"}>
                    {linkedAgent?.status || "No agent"}
                  </Badge>
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />{" "}
                  {linkedAgent?.next_poll_at ? new Date(linkedAgent.next_poll_at).toLocaleTimeString() : "N/A"}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Mobile cards */}
        <div className="divide-y divide-white/5 md:hidden">
          {holdings.map((holding) => {
            const quote = quotes[`${holding.ticker}:${holding.exchange}`];
            const ltp = quote?.ltp ?? null;
            const pos = positionsByHolding[holding.id];
            const pnlRow = pos?.has_exchange_position ? pos.unrealized_pnl_pct : null;
            const up = (pnlRow ?? 0) >= 0;
            const linkedAgent = agentsByHolding[holding.id];
            return (
              <Link
                key={holding.id}
                href={linkedAgent ? `/agents/${linkedAgent.id}#exchange-trades` : "/agents"}
                className="block space-y-3 px-4 py-4 hover:bg-white/[0.02]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{holding.ticker}</div>
                    <div className="font-medium">{holding.exchange}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                    <Badge variant={linkedAgent?.status === "active" ? "success" : "warning"}>
                      {linkedAgent?.status || "No agent"}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Plan qty</div>
                    <div className="mt-0.5 font-medium">{holding.quantity}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Exchange value</div>
                    <div className="mt-0.5 font-medium tabular-nums">
                      {pos?.has_exchange_position && pos.market_value != null ? `₹${pos.market_value.toLocaleString("en-IN")}` : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Entry / Market</div>
                    <div className="mt-0.5 font-medium tabular-nums">₹{holding.entry_price.toFixed(2)}</div>
                    <div className="text-muted-foreground tabular-nums">{ltp != null ? `₹${ltp.toFixed(2)}` : "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">P/L</div>
                    <div className={cn("mt-0.5 font-medium tabular-nums", pnlRow != null ? (up ? "text-emerald-400" : "text-red-400") : "text-muted-foreground")}>
                      {pnlRow != null ? `${up ? "+" : ""}${pnlRow}%` : "—"}
                    </div>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Next poll: {linkedAgent?.next_poll_at ? new Date(linkedAgent.next_poll_at).toLocaleTimeString() : "N/A"}
                </div>
              </Link>
            );
          })}
        </div>

        {holdings.length === 0 && (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-muted-foreground">No monitored stocks yet.</p>
            <Link href="/agents/new" className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110">
              Create your first agent
            </Link>
          </div>
        )}
      </GlassCard>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <GlassCard>
          <h3 className="text-sm font-medium">Sector exposure</h3>
          {sectorExposure.length > 0 ? (
            <div className="mt-4 space-y-3 text-sm">
              {sectorExposure.map(([sector, value]) => (
                <div key={sector}>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{sector}</span>
                    <span>{value}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400" style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              {hasExchangePnl ? "Sector breakdown unavailable." : "P/L and sector breakdown appear after exchange fills."}
            </p>
          )}
        </GlassCard>

        <GlassCard>
          <ChartCardHeader
            title={<h3 className="text-sm font-medium">Exchange equity curve</h3>}
            tabs={<TimeframeTabs value={timeframe} onChange={setTimeframe} options={TIMEFRAME_OPTIONS} size="xs" />}
          />
          {displayChartData.length >= 2 ? (
            <Sparkline data={displayChartData} color="oklch(var(--primary))" height={120} className="mt-4" />
          ) : (
            <p className="mt-8 text-center text-sm text-muted-foreground">Chart appears after exchange fills.</p>
          )}
        </GlassCard>
      </div>

      <div className="mt-8">
        <Disclaimer />
      </div>
    </AppShell>
  );
}
