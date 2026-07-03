"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";

import { api } from "@/lib/api";
import { isBrokerHealthy } from "@/lib/broker-status";
import { AiUnitsUsageCard } from "@/components/daxch/ai-units-usage-card";
import { AppShell } from "@/components/layout/app-shell";
import {
  AreaChart,
  Badge,
  ChartCardHeader,
  Disclaimer,
  Plate,
  Sparkline,
  TimeframeTabs
} from "@/components/daxch/primitives";
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
        const broker = await api.get<{ connected: boolean; expired?: boolean }>("/broker/connection-status");
        setBrokerConnected(isBrokerHealthy(broker));
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

  const dateEyebrow = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short"
  });

  return (
    <AppShell
      eyebrow={dateEyebrow}
      title={profileName ? `${greeting}, ${profileName}.` : `${greeting}.`}
      subtitle={portfolioSubtitle}
      actions={
        <Link href="/agents/new" className="btn-editorial">
          <Plus className="h-3.5 w-3.5" /> New Agent
        </Link>
      }
    >
      <FirstRunChecklist
        items={[
          {
            id: "broker",
            label: "Connect Upstox",
            done: brokerConnected,
            href: "/broker",
            optional: true,
            hint: "OAuth · read-only"
          },
          {
            id: "agent",
            label: "Create your first agent",
            done: agents.length > 0,
            href: "/agents/new",
            hint: "5-step wizard"
          },
          {
            id: "decision",
            label: "Review your first AI conclusion",
            done: hasAgentActivity,
            href: agents[0] ? `/agents/${agents[0].id}` : "/agents",
            hint: "Approve or reject"
          },
          {
            id: "guide",
            label: "Learn how Daxch works",
            done: false,
            href: "/guide",
            hint: "5 min read",
            optional: true
          },
          {
            id: "notify",
            label: "Turn on email notifications",
            done: notificationsOn,
            href: "/settings",
            hint: "2 min"
          }
        ]}
      />

      <div className="grid grid-cols-2 divide-x divide-y divide-[color:var(--ink)]/12 border border-[color:var(--ink)]/12 bg-[color:var(--paper-3)] sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
        <Plate
          eyebrow="Exchange Value"
          value={hasExchangePnl ? `₹${currentValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"}
          delta={
            hasExchangePnl
              ? `${pnl >= 0 ? "+" : ""}₹${Math.abs(pnl).toFixed(0)} · ${pnlPct > 0 ? "+" : ""}${pnlPct.toFixed(2)}%`
              : undefined
          }
          hint={hasExchangePnl ? undefined : "no fills yet"}
          up={pnl >= 0}
        />
        <Plate
          eyebrow="Active Agents"
          value={String(agents.length)}
          hint={agents.length ? "monitoring" : "none yet"}
        />
        <Plate eyebrow="Monitored" value={`${holdings.length} stocks`} hint="with agents" />
        <Plate
          eyebrow="Today's Alerts"
          value={String(notifications.length)}
          delta={notifications.length ? "new events" : "quiet"}
        />
        <Plate
          eyebrow="AI Units"
          value={aiQuota ? `${formatAiUnits(aiQuota.total_remaining)} left` : currentPlan.toUpperCase()}
          delta={aiQuota ? `${formatPercentUsed(aiQuota.percent_used)}% used` : undefined}
          warn={!!aiQuota && aiQuota.percent_used >= 80}
          hint={currentPlan !== "none" ? currentPlan : "subscribe"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="border border-[color:var(--ink)]/12 bg-[color:var(--paper-3)] p-8 lg:col-span-2">
          <ChartCardHeader
            title={
              <div>
                <div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-[color:var(--ink-2)]/60">
                  <span className="inline-block h-px w-6 bg-[color:var(--ink)]" />
                  Exchange P/L · Filled orders only
                </div>
                <div className="flex flex-wrap items-baseline gap-4">
                  <div className="font-mono text-4xl tracking-tight text-[color:var(--ink)]">
                    {hasExchangePnl ? `₹${currentValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"}
                  </div>
                  {hasExchangePnl && (
                    <span
                      className={cn(
                        "font-mono text-sm font-medium",
                        pnl >= 0 ? "text-[color:var(--forest)]" : "text-[color:var(--destructive)]"
                      )}
                    >
                      {pnl >= 0 ? "+" : ""}₹{pnl.toFixed(0)} · {pnlPct > 0 ? "+" : ""}
                      {pnlPct.toFixed(2)}%
                    </span>
                  )}
                </div>
                <p className="mt-3 max-w-md text-xs italic leading-relaxed text-[color:var(--ink-2)]/70">
                  Only positions filled through Daxch-approved Upstox orders count here. Manual Demat holdings are
                  excluded by design.
                </p>
              </div>
            }
            tabs={<TimeframeTabs value={timeframe} onChange={setTimeframe} options={TIMEFRAME_OPTIONS} />}
          />
          <div className="mt-6">
            {displayChartData.length >= 2 ? (
              <AreaChart
                data={displayChartData}
                color="var(--forest)"
                height={240}
                wrapperClassName="h-44 sm:h-56 md:h-[240px]"
              />
            ) : (
              <p className="py-16 text-center text-sm text-[color:var(--ink-2)]/70">
                {holdings.length === 0 ? "Add holdings to see portfolio performance." : "Chart data unavailable."}
              </p>
            )}
          </div>
        </div>

        <div className="border border-[color:var(--ink)]/12 bg-[color:var(--paper-3)] p-6">
          <AiUnitsUsageCard variant="dashboard" quota={aiQuota} className="!mt-0 border-0 bg-transparent p-0 shadow-none" />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="border border-[color:var(--ink)]/12 bg-[color:var(--paper-3)] p-6 lg:col-span-2">
          <div className="mb-5 flex items-baseline justify-between">
            <h3 className="font-serif text-lg text-[color:var(--ink)]">Market Summary</h3>
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[color:var(--ink-2)]/60">
              NSE · Live
            </span>
          </div>
          <div className="divide-y divide-[color:var(--ink)]/10">
            {marketSummary.length > 0 ? (
              marketSummary.map((m) => (
                <div key={m.name} className="grid grid-cols-[1.2fr_1fr_1fr_auto] items-center gap-6 py-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[color:var(--ink)]">{m.name}</div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--ink-2)]/60">
                      Index · India
                    </div>
                  </div>
                  <div className="font-mono text-lg tracking-tight">{m.value}</div>
                  {m.data?.length >= 2 ? (
                    <Sparkline
                      data={m.data}
                      color={m.up ? "var(--forest)" : "var(--destructive)"}
                      height={32}
                    />
                  ) : (
                    <span className="text-xs text-[color:var(--ink-2)]/50">—</span>
                  )}
                  <span
                    className={cn(
                      "font-mono text-sm font-semibold",
                      m.up ? "text-[color:var(--forest)]" : "text-[color:var(--destructive)]"
                    )}
                  >
                    {m.delta}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-4 text-sm text-[color:var(--ink-2)]/70">Market data unavailable.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 border border-[color:var(--ink)]/12 bg-[color:var(--paper-3)]">
        <div className="flex items-baseline justify-between border-b border-[color:var(--ink)] p-6">
          <div>
            <h3 className="font-serif text-2xl text-[color:var(--ink)]">Tracked Stocks</h3>
            <p className="mt-1 text-xs italic text-[color:var(--ink-2)]/70">
              Planned entry & quantity — not synced from Demat. Exchange P/L reflects Daxch-filled orders only.
            </p>
          </div>
          <Link
            href="/portfolio"
            className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[color:var(--forest)] hover:text-[color:var(--ink)]"
          >
            Open portfolio <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-6 border-b border-[color:var(--ink)]/12 px-6 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--ink-2)]/60 md:grid">
          <span>Holding</span>
          <span>Planned</span>
          <span>Live</span>
          <span>Exchange P/L</span>
          <span className="text-right">→</span>
        </div>

        {holdings.map((holding) => {
          const quote = quotes[`${holding.ticker}:${holding.exchange}`];
          const ltp = quote?.ltp ?? null;
          const pos = positionsByHolding[holding.id];
          const holdingPnlPct = pos?.has_exchange_position ? pos.unrealized_pnl_pct : null;
          const up = (holdingPnlPct ?? 0) >= 0;
          const agent = agents.find((a) => a.holding_id === holding.id);
          return (
            <Link
              key={holding.id}
              href={agent ? `/agents/${agent.id}` : "/portfolio"}
              className="grid grid-cols-1 items-center gap-3 border-b border-[color:var(--ink)]/10 px-6 py-4 text-sm last:border-b-0 hover:bg-[color:var(--paper-2)]/60 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] md:gap-6"
            >
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--ink-2)]/60">
                  {holding.sector || "—"}
                </div>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="font-mono text-sm font-bold text-[color:var(--ink)]">{holding.ticker}</span>
                  <span className="font-mono text-[10px] uppercase text-[color:var(--ink-2)]/50">{holding.exchange}</span>
                </div>
              </div>
              <div className="font-mono">
                <div>
                  {holding.quantity} × ₹{holding.entry_price.toFixed(0)}
                </div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--ink-2)]/60">
                  {pos?.has_exchange_position ? `${pos.net_quantity} filled` : "Awaiting fill"}
                </div>
              </div>
              <div className="font-mono">
                {ltp != null ? `₹${ltp.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—"}
              </div>
              <div
                className={cn(
                  "font-mono text-sm font-semibold",
                  holdingPnlPct != null
                    ? up
                      ? "text-[color:var(--forest)]"
                      : "text-[color:var(--destructive)]"
                    : "text-[color:var(--ink-2)]/50"
                )}
              >
                {holdingPnlPct != null ? `${up ? "+" : ""}${holdingPnlPct.toFixed(2)}%` : "—"}
              </div>
              <ArrowUpRight className="hidden h-4 w-4 text-[color:var(--ink-2)]/40 md:block" />
            </Link>
          );
        })}
        {holdings.length === 0 && (
          <p className="px-6 py-8 text-sm text-[color:var(--ink-2)]/70">No tracked stocks yet.</p>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="border border-[color:var(--ink-2)]/12 bg-[color:var(--paper-3)] p-6 lg:col-span-2">
          <div className="mb-6 flex items-baseline justify-between">
            <h3 className="font-serif text-lg text-[color:var(--ink)]">Sector Exposure</h3>
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[color:var(--ink-2)]/60">
              % of exchange value
            </span>
          </div>
          <div className="space-y-4">
            {sectorExposure.length > 0 ? (
              sectorExposure.map(({ sector, pct }) => (
                <div key={sector}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-sm">{sector}</span>
                    <span className="font-mono text-xs font-semibold">{pct}%</span>
                  </div>
                  <div className="h-1 w-full bg-[color:var(--paper-2)]">
                    <div className="h-full bg-[color:var(--ink)]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[color:var(--ink-2)]/70">Add tracked stocks to see sector breakdown.</p>
            )}
          </div>
        </div>

        <div className="border border-[color:var(--ink)]/12 bg-[color:var(--paper-3)] p-6 lg:col-span-3">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="font-serif text-lg text-[color:var(--ink)]">Latest Notifications</h3>
            <Link
              href="/notifications"
              className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[color:var(--forest)] hover:text-[color:var(--ink)]"
            >
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-[color:var(--ink)]/10">
            {notifications.slice(0, 5).map((n) => (
              <div
                key={n.id}
                className="flex items-center gap-4 py-3 hover:bg-[color:var(--paper-2)]/50"
              >
                <Badge variant="neutral">{n.event_type}</Badge>
                <div className="min-w-0 flex-1 truncate text-sm">{n.title}</div>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--ink-2)]/60">
                  {new Date(n.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
            {!notifications.length && (
              <p className="py-4 text-sm text-[color:var(--ink-2)]/70">No new system updates</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <Disclaimer />
      </div>
    </AppShell>
  );
}
