"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Bell, Bot, ListChecks, Plus, Sparkles, TrendingUp } from "lucide-react";

import { api } from "@/lib/api";
import { AiUnitsUsageCard } from "@/components/daxch/ai-units-usage-card";
import { AppShell } from "@/components/layout/app-shell";
import { AreaChart, ChartCardHeader, Disclaimer, GlassCard, Sparkline, StatCard, TimeframeTabs } from "@/components/daxch/primitives";
import { FirstRunChecklist } from "@/components/daxch/first-run-checklist";
import { MarketLiveBadge } from "@/components/daxch/market-live-badge";
import { sliceByTimeframe } from "@/lib/chart";
import { logger } from "@/lib/logger";
import { MonitorAgent, NotificationEvent, StockHolding, UserSettings, AiUnitsQuota, ExchangePositionsResponse } from "@/types";
import { formatAiUnits, formatPercentUsed } from "@/lib/ai-units";
import { cn } from "@/lib/utils";

type MarketIndex = {
  name: string;
  value: string;
  delta: string;
  up: boolean;
  data: number[];
};

const TIMEFRAME_OPTIONS = ["1D", "1W", "1M", "3M", "1Y", "All"] as const;
type ChartTimeframe = (typeof TIMEFRAME_OPTIONS)[number];

export default function DashboardPage() {
  const [holdings, setHoldings] = useState<StockHolding[]>([]);
  const [agents, setAgents] = useState<MonitorAgent[]>([]);
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [currentPlan, setCurrentPlan] = useState("unknown");
  const [quotes, setQuotes] = useState<Record<string, { ltp: number; change_percent: number | null }>>({});
  const [portfolioHistory, setPortfolioHistory] = useState<number[]>([]);
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("1M");
  const [marketSummary, setMarketSummary] = useState<MarketIndex[]>([]);
  const [profileName, setProfileName] = useState("");
  const [brokerConnected, setBrokerConnected] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState(false);
  const [hasAgentActivity, setHasAgentActivity] = useState(false);
  const [exchangeSummary, setExchangeSummary] = useState<ExchangePositionsResponse["summary"] | null>(null);
  const [positionsByHolding, setPositionsByHolding] = useState<Record<string, ExchangePositionsResponse["positions"][0]>>({});
  const [aiQuota, setAiQuota] = useState<AiUnitsQuota | null>(null);

  const displayChartData = useMemo(() => sliceByTimeframe(portfolioHistory, timeframe), [portfolioHistory, timeframe]);

  const refreshData = async () => {
    try {
      const [holdingData, agentData, notificationData, settingsData] = await Promise.all([
        api.get<StockHolding[]>("/stocks"),
        api.get<MonitorAgent[]>("/agents"),
        api.get<NotificationEvent[]>("/notifications?limit=20"),
        api.get<UserSettings>("/settings")
      ]);
      setHoldings(holdingData);
      setAgents(agentData);
      setNotifications(notificationData);
      setProfileName(settingsData.profile_name || "");
      setNotificationsOn(
        Boolean(settingsData.notification_preferences?.agent_conclusion_updates || settingsData.notification_preferences?.daily_digest_email)
      );

      try {
        const broker = await api.get<{ connected: boolean }>("/broker/connection-status");
        setBrokerConnected(broker.connected);
      } catch {
        setBrokerConnected(false);
      }

      setHasAgentActivity(notificationData.some((n) => n.event_type === "agent"));

      try {
        const marketData = await api.get<MarketIndex[]>("/stocks/market-summary");
        if (marketData.length === 0) {
          logger.warn("Market summary returned empty", { page: "dashboard", endpoint: "/stocks/market-summary" });
        }
        setMarketSummary(marketData);
      } catch (err) {
        logger.warn("Failed to load market summary", { page: "dashboard", message: (err as Error).message });
        setMarketSummary([]);
      }

      const subscription = await api.get<{ plan: string; status?: string } | null>("/subscriptions/current");
      setCurrentPlan(
        subscription?.status === "active" && subscription.plan
          ? subscription.plan
          : "none"
      );

      let positionsRes: ExchangePositionsResponse | null = null;
      try {
        positionsRes = await api.get<ExchangePositionsResponse>("/stocks/positions");
        setExchangeSummary(positionsRes.summary);
        setPositionsByHolding(
          Object.fromEntries(positionsRes.positions.map((p) => [p.holding_id, p]))
        );
      } catch {
        setExchangeSummary(null);
        setPositionsByHolding({});
      }

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
              page: "dashboard",
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

      try {
        const quota = await api.get<AiUnitsQuota>("/ai-units/current");
        setAiQuota(quota);
      } catch {
        setAiQuota(null);
      }

      const activePositions = (positionsRes?.positions ?? []).filter(
        (p) => p.has_exchange_position && p.net_quantity > 0
      );
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
                logger.warn("Candle data unavailable for holding", {
                  page: "dashboard",
                  ticker: pos.ticker,
                  message: (err as Error).message
                });
                return [] as number[];
              }
            })
          );
          const validHistories = histories.filter((series) => series.length > 0);
          if (validHistories.length === 0) {
            logger.warn("No portfolio chart data available", { page: "dashboard" });
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
          logger.error("Failed to build portfolio history", { page: "dashboard", message: (err as Error).message });
          setPortfolioHistory([]);
        }
      } else {
        setPortfolioHistory([]);
      }
    } catch (error) {
      logger.error("Failed to refresh dashboard", { page: "dashboard", message: (error as Error).message });
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const hasExchangePnl = Boolean(exchangeSummary?.has_exchange_positions);
  const pnl = exchangeSummary?.unrealized_pnl ?? 0;
  const pnlPct = exchangeSummary?.unrealized_pnl_pct ?? 0;
  const currentValue = exchangeSummary?.market_value ?? 0;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const portfolioSubtitle =
    !hasExchangePnl
      ? `${agents.length} agent${agents.length === 1 ? "" : "s"} monitoring. P/L appears after exchange fills.`
      : pnlPct > 1
        ? `Exchange portfolio up ${pnlPct.toFixed(1)}%. ${agents.length} agent${agents.length === 1 ? "" : "s"} monitoring.`
        : pnlPct < -1
          ? `Exchange portfolio down ${Math.abs(pnlPct).toFixed(1)}%. ${agents.length} agent${agents.length === 1 ? "" : "s"} monitoring.`
          : `Exchange portfolio near even. ${agents.length} agent${agents.length === 1 ? "" : "s"} monitoring.`;

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
    const entries = Object.entries(totals).map(([sector, value]) => ({
      sector,
      pct: grandTotal > 0 ? Math.round((value / grandTotal) * 100) : 0
    }));
    entries.sort((a, b) => b.pct - a.pct);
    return entries;
  }, [holdings, positionsByHolding, hasExchangePnl]);

  return (
    <AppShell
      title={profileName ? `${greeting}, ${profileName}.` : `${greeting}.`}
      subtitle={portfolioSubtitle}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <MarketLiveBadge />
          <Link href="/agents/new" className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-[oklch(0.15_0_0)]">
            <Plus className="h-4 w-4" /> New Agent
          </Link>
        </div>
      }
    >
      <FirstRunChecklist
        items={[
          { id: "broker", label: "Connect Upstox for approved trades", done: brokerConnected, href: "/onboarding/broker", optional: true },
          { id: "agent", label: "Create your first monitoring agent", done: agents.length > 0, href: "/agents/new" },
          { id: "decision", label: "Review your first AI conclusion", done: hasAgentActivity, href: agents[0] ? `/agents/${agents[0].id}` : "/agents" },
          { id: "notify", label: "Turn on email notifications", done: notificationsOn, href: "/settings" }
        ]}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Exchange value"
          value={hasExchangePnl ? `₹${currentValue.toFixed(2)}` : "—"}
          delta={hasExchangePnl ? `${pnlPct > 0 ? "+" : ""}${pnlPct.toFixed(2)}%` : undefined}
          trend={hasExchangePnl ? (pnl >= 0 ? "up" : "down") : "flat"}
          hint={hasExchangePnl ? "filled orders × live price" : "no fills yet"}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard label="Active Agents" value={String(agents.length)} delta={agents.length ? "monitoring" : "none yet"} trend={agents.length ? "up" : "flat"} icon={<Bot className="h-4 w-4" />} />
        <StatCard label="Monitored stocks" value={String(holdings.length)} hint="with agents" icon={<ListChecks className="h-4 w-4" />} />
        <StatCard label="Today's Alerts" value={String(notifications.length)} delta={notifications.length ? "new events" : "quiet"} trend="flat" icon={<Bell className="h-4 w-4" />} />
        <StatCard
          label="Current Plan"
          value={currentPlan.toUpperCase()}
          hint={
            aiQuota
              ? `${formatAiUnits(aiQuota.total_remaining)} units left`
              : currentPlan === "none"
                ? "subscribe"
                : "subscription"
          }
          delta={aiQuota ? `${formatPercentUsed(aiQuota.percent_used)}% used` : currentPlan === "none" ? "subscribe" : "subscription"}
          trend="flat"
          icon={<Sparkles className="h-4 w-4" />}
        />
      </div>

      <AiUnitsUsageCard variant="dashboard" quota={aiQuota} />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <ChartCardHeader
            title={
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Portfolio Performance</div>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <div className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">₹{currentValue.toFixed(2)}</div>
                  <span className={pnl >= 0 ? "text-sm font-medium text-emerald-400" : "text-sm font-medium text-red-400"}>
                    {pnl >= 0 ? "+" : ""}₹{pnl.toFixed(2)} · {pnlPct > 0 ? "+" : ""}
                    {pnlPct.toFixed(2)}%
                  </span>
                </div>
              </div>
            }
            tabs={<TimeframeTabs value={timeframe} onChange={setTimeframe} options={TIMEFRAME_OPTIONS} />}
          />
          <div className="mt-6">
            {displayChartData.length >= 2 ? (
              <AreaChart
                data={displayChartData}
                color="oklch(var(--primary))"
                height={260}
                wrapperClassName="h-44 sm:h-56 md:h-[260px]"
              />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {holdings.length === 0 ? "Add holdings to see portfolio performance." : "Chart data unavailable."}
              </p>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Market Summary</div>
          <div className="mt-5 space-y-4">
            {marketSummary.length > 0 ? (
              marketSummary.map((m) => (
                <div key={m.name} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 sm:gap-4">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{m.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{m.value}</div>
                  </div>
                  {m.data?.length >= 2 ? (
                    <div className="h-8 w-16 shrink-0 sm:w-20">
                      <Sparkline data={m.data} color={m.up ? "oklch(var(--success))" : "oklch(var(--destructive))"} height={32} />
                    </div>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">—</span>
                  )}
                  <span className={cn("shrink-0 text-xs font-medium", m.up ? "text-emerald-400" : "text-red-400")}>{m.delta}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Market data unavailable.</p>
            )}
          </div>
        </GlassCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-medium tracking-tight">Latest Notifications</h3>
            <Link href="/notifications" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-5 space-y-2">
            {notifications.slice(0, 5).map((n) => (
              <div key={n.id} className="flex items-center gap-3 rounded-xl border border-border/15 bg-muted/60 p-3 hover:border-border/25">
                <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {n.event_type}
                </span>
                <div className="min-w-0 flex-1 truncate text-sm">{n.title}</div>
                <span className="shrink-0 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleTimeString()}</span>
              </div>
            ))}
            {!notifications.length && (
              <div className="rounded-xl border border-border/15 bg-muted/60 p-3 text-sm text-muted-foreground">
                No new system updates
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium tracking-tight">Tracked stocks</h3>
            <Link href="/portfolio" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              Open Portfolio <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-5 space-y-2">
            {holdings.map((holding) => {
              const quote = quotes[`${holding.ticker}:${holding.exchange}`];
              const ltp = quote?.ltp ?? null;
              const pos = positionsByHolding[holding.id];
              const holdingPnlPct = pos?.has_exchange_position ? pos.unrealized_pnl_pct : null;
              const up = (holdingPnlPct ?? 0) >= 0;
              return (
                <div key={holding.id} className="rounded-xl border border-border/15 bg-muted/60 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">
                      {holding.ticker} <span className="text-xs text-muted-foreground">({holding.exchange})</span>
                    </p>
                    <span className={holdingPnlPct != null ? (up ? "text-xs font-medium text-emerald-400" : "text-xs font-medium text-red-400") : "text-xs text-muted-foreground"}>
                      {holdingPnlPct != null ? `${up ? "+" : ""}${holdingPnlPct.toFixed(2)}%` : "—"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-muted-foreground">
                      {holding.sector ? <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{holding.sector}</span> : null}
                      <span className="ml-1.5">
                        {pos?.has_exchange_position ? `${pos.net_quantity} on exchange` : `Plan: ${holding.quantity} @ ₹${holding.entry_price.toFixed(0)}`}
                      </span>
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {ltp != null ? `₹${ltp.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "Quote unavailable"}
                    </span>
                  </div>
                </div>
              );
            })}
            {holdings.length === 0 && <p className="text-sm text-muted-foreground">No tracked stocks yet.</p>}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium tracking-tight">Sector Exposure</h3>
            <Link href="/portfolio" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              Portfolio <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-5 space-y-3 text-sm">
            {sectorExposure.length > 0 ? sectorExposure.map(({ sector, pct }) => (
              <div key={sector}>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{sector}</span>
                  <span>{pct}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">Add tracked stocks to see sector breakdown.</p>
            )}
          </div>
        </GlassCard>
      </div>

      <div className="mt-8">
        <Disclaimer />
      </div>
    </AppShell>
  );
}
