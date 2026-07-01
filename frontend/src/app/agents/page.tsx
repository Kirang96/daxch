"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Bot, Plus, Search } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge, Disclaimer, GlassCard, Sparkline, AlertBanner } from "@/components/daxch/primitives";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { formatAiUnits } from "@/lib/ai-units";
import { AgentDecision, AiUnitsEstimate, MonitorAgent, StockHolding } from "@/types";

export default function AgentsPage() {
  const [agents, setAgents] = useState<MonitorAgent[]>([]);
  const [holdings, setHoldings] = useState<StockHolding[]>([]);
  const [decisionsByAgent, setDecisionsByAgent] = useState<Record<string, AgentDecision[]>>({});
  const [quotesByTicker, setQuotesByTicker] = useState<Record<string, { ltp: number; change_percent: number | null }>>({});
  const [candlesByTicker, setCandlesByTicker] = useState<Record<string, number[]>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"All" | "Healthy" | "Watch" | "Alert">("All");
  const [error, setError] = useState("");
  const [agentLimit, setAgentLimit] = useState<number | null>(null);
  const [monthlyEstimate, setMonthlyEstimate] = useState<number | null>(null);

  const refresh = async () => {
    try {
      setError("");
      const [agentData, holdingData] = await Promise.all([
        api.get<MonitorAgent[]>("/agents"),
        api.get<StockHolding[]>("/stocks")
      ]);
      setAgents(agentData);
      setHoldings(holdingData);

      try {
        const [subscription, plans] = await Promise.all([
          api.get<{ plan: string; status: string } | null>("/subscriptions/current"),
          api.get<Record<string, { agent_limit: number | null }>>("/subscriptions/plans")
        ]);
        const planKey = subscription?.plan?.toLowerCase() || "starter";
        setAgentLimit(plans[planKey]?.agent_limit ?? null);
      } catch {
        setAgentLimit(10);
      }

      try {
        const estimate = await api.get<AiUnitsEstimate>("/ai-units/estimate/portfolio");
        setMonthlyEstimate(estimate.estimated_monthly_units);
      } catch {
        setMonthlyEstimate(null);
      }

      const decisionEntries = await Promise.all(
        agentData.map(async (agent) => {
          try {
            const decisions = await api.get<AgentDecision[]>(`/agents/${agent.id}/decisions`);
            return [agent.id, decisions] as const;
          } catch {
            return [agent.id, []] as const;
          }
        })
      );
      setDecisionsByAgent(Object.fromEntries(decisionEntries));

      const tickerPairs = Array.from(new Set(holdingData.map((holding) => `${holding.ticker}:${holding.exchange}`)));
      const quoteEntries = await Promise.all(
        tickerPairs.map(async (pair) => {
          const [ticker, exchange] = pair.split(":");
          try {
            const quote = await api.get<{ ticker: string; ltp: number; change_percent: number | null }>(
              `/stocks/quote/${ticker}?exchange=${exchange}`
            );
            return [pair, { ltp: quote.ltp, change_percent: quote.change_percent }] as const;
          } catch (err) {
            logger.warn("Quote unavailable for agent holding", {
              page: "agents",
              ticker,
              message: (err as Error).message
            });
            return [pair, null] as const;
          }
        })
      );
      setQuotesByTicker(
        Object.fromEntries(
          quoteEntries.filter((entry): entry is [string, { ltp: number; change_percent: number | null }] => entry[1] !== null)
        )
      );

      const candleEntries = await Promise.all(
        tickerPairs.map(async (pair) => {
          const [ticker, exchange] = pair.split(":");
          try {
            const res = await api.get<{ prices: number[] }>(`/stocks/candles/${ticker}?exchange=${exchange}`);
            return [pair, res.prices] as const;
          } catch (err) {
            logger.warn("Candle data unavailable for agent", { page: "agents", ticker, message: (err as Error).message });
            return [pair, []] as const;
          }
        })
      );
      setCandlesByTicker(Object.fromEntries(candleEntries));
    } catch (err) {
      logger.error("Failed to load agents", { page: "agents", message: (err as Error).message });
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const holdingsById = useMemo(
    () => Object.fromEntries(holdings.map((holding) => [holding.id, holding])),
    [holdings]
  );

  const cards = useMemo(() => {
    return agents.map((agent) => {
      const holding = holdingsById[agent.holding_id];
      const decisions = decisionsByAgent[agent.id] || [];
      const latestDecision = decisions[0];
      const decisionType = latestDecision?.decision_type || "hold";
      const confirmation = latestDecision?.confirmation_status || "approved";
      const confidenceRaw = latestDecision?.analysis_data?.confidence;
      const confidence =
        typeof confidenceRaw === "number"
          ? `${Math.round(confidenceRaw * 100)}%`
          : typeof confidenceRaw === "string"
            ? confidenceRaw
            : "n/a";
      const tickerKey = holding ? `${holding.ticker}:${holding.exchange}` : "";
      const quote = tickerKey ? quotesByTicker[tickerKey] : undefined;
      const ltp = quote?.ltp ?? null;
      const entry = holding?.entry_price ?? 0;
      const pnlPct = ltp != null && entry > 0 ? (((ltp - entry) / entry) * 100).toFixed(2) : null;
      const status =
        agent.status !== "active"
          ? "alert"
          : decisionType === "sell"
            ? "alert"
            : confirmation === "pending"
              ? "watch"
              : "healthy";
      return {
        agent,
        holding,
        latestDecision,
        decisionType,
        confidence,
        ltp,
        pnlPct,
        status
      };
    });
  }, [agents, holdingsById, decisionsByAgent, quotesByTicker]);

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      const ticker = card.holding?.ticker || "";
      const id = card.agent.id;
      const statusLabel =
        card.status === "healthy" ? "Healthy" : card.status === "watch" ? "Watch" : "Alert";
      const matchesSearch =
        !search ||
        ticker.toLowerCase().includes(search.toLowerCase()) ||
        id.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === "All" || statusLabel === filter;
      return matchesSearch && matchesFilter;
    });
  }, [cards, search, filter]);

  return (
    <AppShell
      title="AI Agents"
      subtitle={
        agentLimit != null
          ? `${agents.length}/${agentLimit} agents · Each monitors one position with evidence-backed conclusions.${
              monthlyEstimate ? ` ~${formatAiUnits(monthlyEstimate)} AI Units/month estimated for monitoring.` : ""
            }`
          : `${agents.length} agents · Each monitors one position.${
              monthlyEstimate ? ` ~${formatAiUnits(monthlyEstimate)} AI Units/month estimated for monitoring.` : ""
            }`
      }
      actions={
        <Link href="/agents/new" className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-[oklch(0.15_0_0)]">
          <Plus className="h-4 w-4" /> New Agent
        </Link>
      }
    >
      {error && <AlertBanner variant="error" className="mb-4">{error}</AlertBanner>}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 w-full flex-1 sm:min-w-[220px] sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search agents..."
            className="w-full rounded-xl border border-border/20 bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="flex w-full gap-1 overflow-x-auto rounded-lg border border-border/20 bg-background p-1 text-xs sm:w-auto">
          {["All", "Healthy", "Watch", "Alert"].map((t, i) => (
            <button
              key={t}
              onClick={() => setFilter(t as "All" | "Healthy" | "Watch" | "Alert")}
              className={
                filter === t
                  ? "rounded-md bg-primary/12 px-3 py-1.5 font-semibold text-primary ring-1 ring-primary/20"
                  : "rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground"
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredCards.map((card) => {
          const statusVar =
            card.status === "healthy" ? "success" : card.status === "watch" ? "warning" : "danger";
          const statusLabel =
            card.status === "healthy" ? "Healthy" : card.status === "watch" ? "Watch" : "Needs review";
          const up = card.pnlPct != null ? Number(card.pnlPct) >= 0 : true;
          const candleKey = `${card.holding?.ticker}:${card.holding?.exchange}`;
          const candles = candlesByTicker[candleKey] ?? [];
          return (
            <Link key={card.agent.id} href={`/agents/${card.agent.id}`} className="block">
              <GlassCard className="cursor-pointer transition-all hover:translate-y-[-2px]">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-sm bg-primary/15 text-primary ring-1 ring-primary/25">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-lg font-semibold tracking-tight">
                        {card.holding?.ticker || "Unknown"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-[140px]">
                        {card.holding?.intention?.split("|")[0]?.trim() || card.holding?.exchange || "NSE"}
                      </div>
                    </div>
                  </div>
                  <Badge variant={statusVar as "success" | "warning" | "danger"}>● {statusLabel}</Badge>
                </div>
                {candles.length >= 2 ? (
                  <Sparkline
                    data={candles}
                    color={up ? "oklch(var(--success))" : "oklch(var(--destructive))"}
                    className="mt-5"
                    height={56}
                  />
                ) : (
                  <p className="mt-5 py-4 text-center text-xs text-muted-foreground">Chart unavailable</p>
                )}
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Price</div>
                    <div className="font-medium">{card.ltp != null ? `₹${card.ltp.toFixed(2)}` : "—"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">PnL</div>
                    <div className={card.pnlPct != null ? (up ? "font-medium text-emerald-400" : "font-medium text-red-400") : "font-medium text-muted-foreground"}>
                      {card.pnlPct != null ? `${up ? "+" : ""}${card.pnlPct}%` : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Conf.</div>
                    <div className="font-medium">{card.confidence}</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-lg border border-border/15 bg-muted/60 px-3 py-2 text-xs">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Activity className="h-3 w-3" /> Conclusion
                  </span>
                  <span className="font-medium">{card.decisionType.replace("_", " ")}</span>
                </div>
              </GlassCard>
            </Link>
          );
        })}
      </div>

      {filteredCards.length === 0 && (
        <GlassCard className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">No agents configured yet.</p>
          <Link
            href="/agents/new"
            className="mt-4 inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-[oklch(0.15_0_0)]"
          >
            <Plus className="h-4 w-4" /> Create your first agent
          </Link>
        </GlassCard>
      )}

      <div className="mt-8">
        <Disclaimer />
      </div>
    </AppShell>
  );
}

