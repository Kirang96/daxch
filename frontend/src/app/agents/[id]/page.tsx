"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Activity,
  ArrowLeft,
  Check,
  Newspaper,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  X
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { AreaChart, Badge, Disclaimer, GlassCard, ThinkingDots, AlertBanner } from "@/components/daxch/primitives";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import {
  lifecycleStepIndex,
  LIFECYCLE_STEPS,
  resolveExchangeTradeStage,
  tradeSideLabel,
} from "@/lib/exchange-trade-lifecycle";
import { logger } from "@/lib/logger";
import { AgentDetail, AgentDecision, BrokerOrderStatus, ExchangePosition, OrderSnapshot } from "@/types";

const FILLED_ORDER_STATUSES = new Set(["complete", "filled", "trade_complete"]);

function isFilledOrderStatus(status: string) {
  return FILLED_ORDER_STATUSES.has(status?.toLowerCase());
}

const ORDER_STATUS_CONFIG: Record<string, { label: string; variant: "success" | "warning" | "danger" | "primary"; icon: React.ComponentType<{ className?: string }> }> = {
  placed:     { label: "Placed",         variant: "primary",  icon: Activity },
  pending:    { label: "Pending",        variant: "warning",  icon: ThinkingDots as unknown as React.ComponentType<{ className?: string }> },
  complete:   { label: "Filled ✓",       variant: "success",  icon: Check },
  open:       { label: "Open (Exchange)",variant: "warning",  icon: Activity },
  rejected:   { label: "Rejected",       variant: "danger",   icon: TrendingDown },
  failed:     { label: "Failed",         variant: "danger",   icon: TrendingDown },
  cancelled:  { label: "Cancelled",      variant: "warning",   icon: TrendingDown },
};

function OrderStatusBadge({ status }: { status: string }) {
  const cfg = ORDER_STATUS_CONFIG[status?.toLowerCase()] ?? { label: status, variant: "warning" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = (params?.id || "agent").toUpperCase();
  const [data, setData] = useState<AgentDetail | null>(null);
  const [candlesData, setCandlesData] = useState<number[]>([]);
  const [liveQuote, setLiveQuote] = useState<{ ltp: number; change_percent: number | null } | null>(null);
  const [error, setError] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [refreshingOrderId, setRefreshingOrderId] = useState<string | null>(null);
  const [liveOrderStatus, setLiveOrderStatus] = useState<Record<string, BrokerOrderStatus>>({});
  const [exchangePosition, setExchangePosition] = useState<ExchangePosition | null>(null);
  const [orderRefreshError, setOrderRefreshError] = useState<Record<string, string>>({});

  const syncOrderFromBroker = useCallback(async (orderId: string) => {
    const live = await api.get<BrokerOrderStatus>(`/broker/orders/${orderId}/status`);
    setLiveOrderStatus((prev) => ({ ...prev, [orderId]: live }));
    return live;
  }, []);

  const syncAllBrokerOrders = useCallback(async (decisions: AgentDecision[]) => {
    const orders = decisions
      .filter((d): d is AgentDecision & { order: OrderSnapshot } => Boolean(d.order?.broker_order_id))
      .map((d) => d.order);
    await Promise.allSettled(
      orders.map(async (order) => {
        try {
          await syncOrderFromBroker(order.id);
        } catch (err) {
          logger.warn("Failed to sync order on load", {
            page: "agent-detail",
            orderId: order.id,
            message: (err as Error).message,
          });
        }
      })
    );
  }, [syncOrderFromBroker]);

  const loadExchangePosition = useCallback(async (holdingId?: string) => {
    if (!holdingId) {
      setExchangePosition(null);
      return;
    }
    try {
      const res = await api.get<{ positions: ExchangePosition[] }>("/stocks/positions");
      const match = res.positions.find((p) => p.holding_id === holdingId);
      setExchangePosition(match?.has_exchange_position ? match : null);
    } catch {
      setExchangePosition(null);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await api.get<AgentDetail>(`/agents/${params?.id}`);
      setData(response);
      await loadExchangePosition(response?.holding?.id);
      await syncAllBrokerOrders(response?.decisions ?? []);

      if (response?.holding?.ticker) {
        const exchange = response.holding.exchange || "NSE";
        try {
          const candles = await api.get<{ prices: number[] }>(
            `/stocks/candles/${response.holding.ticker.toUpperCase()}?exchange=${exchange}`
          );
          if (candles.prices.length === 0) {
            logger.warn("No candle data for agent", { page: "agent-detail", ticker: response.holding.ticker });
          }
          setCandlesData(candles.prices);
        } catch (err) {
          logger.warn("Failed to load candles for agent", {
            page: "agent-detail",
            ticker: response.holding.ticker,
            message: (err as Error).message
          });
          setCandlesData([]);
        }

        try {
          const quote = await api.get<{ ltp: number; change_percent: number | null }>(
            `/stocks/quote/${response.holding.ticker}?exchange=${exchange}`
          );
          setLiveQuote(quote);
        } catch (err) {
          logger.warn("Failed to load live quote for agent", {
            page: "agent-detail",
            ticker: response.holding.ticker,
            message: (err as Error).message
          });
          setLiveQuote(null);
        }
      }
    } catch (err) {
      logger.error("Failed to load agent detail", { page: "agent-detail", message: (err as Error).message });
      setError((err as Error).message);
    }
  }, [params?.id, loadExchangePosition, syncAllBrokerOrders]);

  useEffect(() => {
    if (params?.id) load();
  }, [params?.id, load]);

  const latestDecision = useMemo(() => data?.decisions?.[0], [data]);

  const ordersWithDecisions = useMemo(
    () =>
      (data?.decisions ?? [])
        .filter((d): d is AgentDecision & { order: OrderSnapshot } => Boolean(d.order))
        .map((d) => ({ decision: d, order: d.order })),
    [data]
  );

  const tradeSignals = useMemo(
    () =>
      (data?.decisions ?? []).filter(
        (d) => d.decision_type === "buy_more" || d.decision_type === "sell"
      ),
    [data]
  );

  const filledOrderCount = useMemo(
    () => ordersWithDecisions.filter(({ order }) => isFilledOrderStatus(order.status)).length,
    [ordersWithDecisions]
  );

  const currentPrice = liveQuote?.ltp ?? null;

  const confirmDecision = async (approve: boolean) => {
    if (!latestDecision) return;
    try {
      setActionStatus("");
      await api.post(`/agents/decisions/${latestDecision.id}/confirm?approve=${approve}`, {});
      setActionStatus(approve ? "Decision approved." : "Decision rejected.");
      await load();
      if (data?.holding?.id) await loadExchangePosition(data.holding.id);
    } catch (err) {
      logger.error("Failed to confirm decision", { page: "agent-detail", message: (err as Error).message });
      setActionStatus((err as Error).message);
    }
  };

  const pauseAgent = async () => {
    if (!params?.id) return;
    try {
      setActionStatus("");
      await api.post(`/agents/${params.id}/pause`, {});
      setActionStatus("Agent paused.");
      await load();
      if (data?.holding?.id) await loadExchangePosition(data.holding.id);
    } catch (err) {
      logger.error("Failed to pause agent", { page: "agent-detail", message: (err as Error).message });
      setActionStatus((err as Error).message);
    }
  };

  const resumeAgent = async () => {
    if (!params?.id) return;
    try {
      setActionStatus("");
      await api.post(`/agents/${params.id}/resume`, {});
      setActionStatus("Agent resumed.");
      await load();
      if (data?.holding?.id) await loadExchangePosition(data.holding.id);
    } catch (err) {
      logger.error("Failed to resume agent", { page: "agent-detail", message: (err as Error).message });
      setActionStatus((err as Error).message);
    }
  };

  const refreshOrderStatus = async (orderId: string) => {
    setRefreshingOrderId(orderId);
    setOrderRefreshError((prev) => ({ ...prev, [orderId]: "" }));
    try {
      await syncOrderFromBroker(orderId);
      await load();
    } catch (err) {
      setOrderRefreshError((prev) => ({ ...prev, [orderId]: (err as Error).message }));
    } finally {
      setRefreshingOrderId(null);
    }
  };

  return (
    <AppShell
      title={`${data?.holding?.ticker || "Agent"} · Monitoring`}
      subtitle="AI monitoring for a stock you chose · Approve actions before anything is sent to your broker."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {data?.agent.status === "active" && (
            <Button variant="secondary" onClick={pauseAgent}>
              <Pause className="h-4 w-4" /> Pause
            </Button>
          )}
          {data?.agent.status === "paused" && (
            <Button variant="secondary" onClick={resumeAgent}>
              <Play className="h-4 w-4" /> Resume
            </Button>
          )}
          <Link href="/agents" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm hover:bg-white/[0.06]">
            <ArrowLeft className="h-4 w-4" /> All agents
          </Link>
        </div>
      }
    >
      {error && <AlertBanner variant="error" className="mb-4">{error}</AlertBanner>}
      {actionStatus && <p className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-muted-foreground">{actionStatus}</p>}

      <AlertBanner variant="info" className="mb-6" title="How this page works">
        <strong>Your plan</strong> (entry price and quantity) feeds the AI — it is not synced from your Demat.
        <strong className="ml-1">Exchange trades</strong> below are orders sent to Upstox after you approve a suggestion.
        P/L appears only after an order fills on the exchange.
      </AlertBanner>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant={data?.agent.status === "active" ? "success" : "warning"}>
                  ● {data?.agent.status || "unknown"}
                </Badge>
                <span className="text-muted-foreground">
                  Last analysis · {latestDecision ? new Date(latestDecision.decided_at).toLocaleString() : "n/a"}
                </span>
              </div>
              <h2 className="mt-3 truncate text-xl font-semibold tracking-tight sm:text-2xl">
                {data?.holding?.ticker || id}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{data?.holding?.exchange || "NSE"}</p>
            </div>
            <div className="shrink-0 sm:text-right">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Market price</div>
              <div className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
                {currentPrice != null ? `₹${currentPrice.toFixed(2)}` : "—"}
              </div>
              <div className="mt-1 text-sm font-medium text-muted-foreground">
                Latest signal · {latestDecision?.decision_type?.replace("_", " ") || "hold"}
              </div>
            </div>
          </div>
          <div className="mt-6">
            {candlesData.length >= 2 ? (
              <AreaChart
                data={candlesData}
                color="oklch(var(--primary))"
                height={220}
                wrapperClassName="h-44 sm:h-56 md:h-[220px]"
              />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">Chart data unavailable.</p>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Your plan</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Entry and quantity for AI analysis — not your live broker holding.
              </p>
            </div>
            <Badge variant="neutral">For AI</Badge>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <Row label="Symbol" value={data?.holding?.ticker || "—"} />
            <Row label="Exchange" value={data?.holding?.exchange || "—"} />
            <Row label="Entry price" value={`₹${(data?.holding?.entry_price || 0).toFixed(2)}`} />
            <Row label="Quantity" value={data?.holding?.quantity != null ? String(data.holding.quantity) : "—"} />
            <div className="my-2 h-px bg-border/15" />
            <Row label="Investment goal" value={data?.holding?.intention || "—"} />
            {exchangePosition ? (
              <>
                <div className="my-2 h-px bg-border/15" />
                <Row label="Exchange position" value={`${exchangePosition.net_quantity} shares`} />
                <Row label="Avg cost" value={`₹${exchangePosition.average_cost.toFixed(2)}`} />
                <Row
                  label="Unrealized P/L"
                  value={
                    exchangePosition.unrealized_pnl != null
                      ? `${exchangePosition.unrealized_pnl >= 0 ? "+" : ""}₹${exchangePosition.unrealized_pnl.toFixed(2)}`
                      : "—"
                  }
                  hint={
                    exchangePosition.unrealized_pnl_pct != null
                      ? `${exchangePosition.unrealized_pnl_pct >= 0 ? "+" : ""}${exchangePosition.unrealized_pnl_pct.toFixed(2)}%`
                      : undefined
                  }
                />
              </>
            ) : (
              <p className="text-xs text-muted-foreground">No exchange position yet — P/L appears after a filled order.</p>
            )}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="mt-6" id="exchange-trades">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-medium tracking-tight">Exchange trades</h3>
              {ordersWithDecisions.length > 0 && (
                <Badge variant="primary">
                  {filledOrderCount} filled · {ordersWithDecisions.length} total
                </Badge>
              )}
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Track each buy/sell signal from AI suggestion through your approval to the exchange fill. Status syncs from Upstox when connected.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {tradeSignals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/25 bg-muted/40 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No buy or sell signals yet</p>
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
                When the AI suggests buying or selling, it will appear here with approval status and exchange progress.
              </p>
            </div>
          ) : (
            tradeSignals.map((decision) => (
              <TradeExecutionCard
                key={decision.id}
                decision={decision}
                order={decision.order ?? null}
                live={decision.order ? liveOrderStatus[decision.order.id] : undefined}
                refreshErr={decision.order ? orderRefreshError[decision.order.id] : undefined}
                isRefreshing={decision.order ? refreshingOrderId === decision.order.id : false}
                onRefresh={decision.order ? () => refreshOrderStatus(decision.order!.id) : undefined}
              />
            ))
          )}
        </div>
      </GlassCard>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium tracking-tight">Activity Timeline</h3>
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <ThinkingDots /> Monitoring
            </span>
          </div>
          {data?.recent_audit?.length ? (
            <ol className="relative mt-6 space-y-5 border-l border-white/5 pl-6">
              {data.recent_audit.map((entry) => {
                const timeLabel = new Date(entry.created_at).toLocaleTimeString();
                const title = entry.event_type.replaceAll("_", " ");
                const description = formatAuditDescription(entry.event_type, entry.payload);
                return (
                  <li key={`${entry.created_at}-${entry.event_type}`} className="relative">
                    <span className="absolute -left-[27px] grid h-5 w-5 place-items-center rounded-full border border-white/10 bg-background">
                      <Activity className="h-3 w-3 text-primary" />
                    </span>
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-xs text-muted-foreground">{timeLabel}</span>
                      <span className="text-sm font-medium">{title}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">No activity recorded yet.</p>
          )}
        </GlassCard>

        <div className="space-y-4">
          <GlassCard>
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">AI Conclusion</div>
              <Badge variant="primary">Informational</Badge>
            </div>
            <div className="mt-3 text-xl font-semibold">
              {latestDecision?.decision_type?.replace("_", " ") || "hold"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{latestDecision?.reasoning || "No decision yet."}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <Mini label="Confidence" value={String(latestDecision?.analysis_data?.confidence || "n/a")} />
              <Mini label="Risk" value={String(latestDecision?.analysis_data?.risk_summary || "n/a")} />
              <Mini label="Status" value={latestDecision?.confirmation_status || "n/a"} />
            </div>
            {latestDecision?.confirmation_status === "pending" && (
              <div className="mt-4 flex gap-2">
                <Button className="flex-1" onClick={() => confirmDecision(true)}>
                  <Check className="h-4 w-4" /> Approve
                </Button>
                <Button variant="secondary" className="flex-1" onClick={() => confirmDecision(false)}>
                  <X className="h-4 w-4" /> Reject
                </Button>
              </div>
            )}
          </GlassCard>

          <GlassCard>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Reasoning</div>
            <ul className="mt-3 space-y-2 text-sm">
              {(data?.decisions?.length
                ? data.decisions.slice(0, 4).map((decision) => decision.reasoning)
                : ["No reasoning available"]).map((reason) => (
                <li key={reason} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 text-emerald-400" /> {reason}
                </li>
              ))}
            </ul>
          </GlassCard>

          {latestDecision?.analysis_data?.risk_summary != null && (
            <GlassCard className="border-amber-300/60 bg-amber-50">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-900">
                <ShieldAlert className="h-3.5 w-3.5" /> Risk Summary
              </div>
              <p className="mt-2 text-xs leading-relaxed text-amber-950">
                {String(latestDecision.analysis_data.risk_summary)}
              </p>
            </GlassCard>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <h3 className="text-sm font-medium">Supporting News</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {(Array.isArray(latestDecision?.analysis_data?.news)
              ? (latestDecision?.analysis_data?.news as string[])
              : []).length > 0 ? (
              (latestDecision?.analysis_data?.news as string[]).map((n) => (
                <li key={n} className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <Newspaper className="mt-0.5 h-3.5 w-3.5 text-primary" /> {n}
                </li>
              ))
            ) : (
              <li className="text-xs text-muted-foreground">No linked news available.</li>
            )}
          </ul>
        </GlassCard>
        <GlassCard>
          <h3 className="text-sm font-medium">Suggestion history</h3>
          <p className="mt-1 text-xs text-muted-foreground">AI recommendations and whether you approved them. Only approved non-hold actions may create exchange trades above.</p>
          <ul className="mt-3 space-y-2 text-sm">
            {(data?.decisions?.length ? data.decisions : []).slice(0, 5).map((decision) => {
              const stage =
                decision.decision_type === "buy_more" || decision.decision_type === "sell"
                  ? resolveExchangeTradeStage(decision, decision.order ?? null).label
                  : null;
              return (
              <li key={decision.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <div className="hidden items-center gap-3 sm:grid sm:grid-cols-[120px_1fr_auto_auto]">
                  <span className="text-xs text-muted-foreground">
                    {new Date(decision.decided_at).toLocaleDateString()}
                  </span>
                  <span>{decision.decision_type.replace("_", " ")}</span>
                  <Badge variant={decision.confirmation_status === "approved" ? "success" : "warning"}>
                    {decision.confirmation_status}
                  </Badge>
                  {stage ? (
                    <Badge variant="primary">{stage}</Badge>
                  ) : decision.order ? (
                    <OrderStatusBadge status={decision.order.broker_status ?? decision.order.status} />
                  ) : null}
                </div>
                <div className="space-y-2 sm:hidden">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium capitalize">{decision.decision_type.replace("_", " ")}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(decision.decided_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={decision.confirmation_status === "approved" ? "success" : "warning"}>
                      {decision.confirmation_status}
                    </Badge>
                    {stage ? (
                      <Badge variant="primary">{stage}</Badge>
                    ) : decision.order ? (
                      <OrderStatusBadge status={decision.order.broker_status ?? decision.order.status} />
                    ) : null}
                  </div>
                </div>
              </li>
            );
            })}
            {!data?.decisions?.length && <li className="text-xs text-muted-foreground">No previous suggestions.</li>}
          </ul>
        </GlassCard>
      </div>

      <div className="mt-8">
        <Disclaimer />
      </div>
    </AppShell>
  );
}

function TradeExecutionCard({
  decision,
  order,
  live,
  refreshErr,
  isRefreshing,
  onRefresh
}: {
  decision: AgentDecision;
  order: OrderSnapshot | null;
  live?: BrokerOrderStatus;
  refreshErr?: string;
  isRefreshing: boolean;
  onRefresh?: () => void;
}) {
  const stageInfo = resolveExchangeTradeStage(decision, order, live);
  const side = tradeSideLabel(decision.decision_type);
  const activeStep = lifecycleStepIndex(stageInfo.stage);
  const qty = order?.quantity ?? (decision.analysis_data?.quantity_delta as number | undefined) ?? "—";
  const price = order?.price ?? (decision.analysis_data?.suggested_entry as number | undefined);
  const filledQty = live?.filled_quantity ?? order?.filled_quantity ?? 0;
  const avgPrice = live?.average_price ?? order?.average_price;

  return (
    <div className="rounded-xl border border-border/15 bg-muted/30 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={side.variant}>{side.label}</Badge>
            <Badge variant={stageInfo.variant}>{stageInfo.label}</Badge>
            {order && typeof qty === "number" && (
              <span className="text-sm font-medium">
                {qty} shares{price != null ? ` @ ₹${Number(price).toFixed(2)}` : ""}
              </span>
            )}
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">{stageInfo.description}</p>

          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
            {LIFECYCLE_STEPS.map((step, index) => {
              const done = index < activeStep;
              const current = index === activeStep;
              return (
                <div key={step.key} className="text-center">
                  <div
                    className={`mx-auto mb-1 h-1.5 rounded-full ${
                      done ? "bg-emerald-500" : current ? "bg-primary" : "bg-white/10"
                    }`}
                  />
                  <div className={`text-[10px] ${current ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                    {step.label}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Signal · {new Date(decision.decided_at).toLocaleString()}</span>
            <span>
              Your call ·{" "}
              {decision.confirmation_status === "auto_executed"
                ? "auto-approved"
                : decision.confirmation_status.replace("_", " ")}
            </span>
            {order?.broker_order_id && (
              <span>
                Broker ID · <code className="font-mono text-foreground/70">{order.broker_order_id}</code>
              </span>
            )}
          </div>

          {(order || live) && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-border/12 bg-background/80 p-2.5 text-xs">
              <Row label="Order status" value={order?.status?.replace("_", " ") ?? "—"} />
              <Row
                label="Exchange status"
                value={(live?.broker_status ?? order?.broker_status ?? "not sent").replace("_", " ")}
              />
              <Row label="Filled qty" value={String(filledQty)} />
              <Row
                label="Pending qty"
                value={String(live?.pending_quantity ?? Math.max(0, (order?.quantity ?? 0) - filledQty))}
              />
              {avgPrice != null && <Row label="Avg fill price" value={`₹${avgPrice.toFixed(2)}`} />}
              {live?.exchange_order_id && <Row label="Exchange ID" value={live.exchange_order_id} />}
              {order?.filled_at && (
                <Row label="Filled at" value={new Date(order.filled_at).toLocaleString()} />
              )}
              {live?.message && (
                <div className="col-span-2 mt-1 rounded border border-amber-300/60 bg-amber-50 px-2 py-1 text-amber-900">
                  {live.message}
                </div>
              )}
            </div>
          )}

          {refreshErr && <p className="text-xs text-red-700">{refreshErr}</p>}
        </div>
        {order?.broker_order_id && onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border/15 bg-background px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Syncing…" : "Refresh status"}
          </button>
        )}
      </div>
    </div>
  );
}

function formatAuditDescription(eventType: string, payload: Record<string, unknown>): string {
  const type = eventType.replaceAll("_", " ");
  if (eventType === "decision_created") {
    const decision = String(payload.decision_type ?? "suggestion").replaceAll("_", " ");
    return `AI generated a ${decision} suggestion for your review.`;
  }
  if (eventType === "decision_confirmed") {
    return payload.approved ? "You approved the suggestion." : "You rejected the suggestion.";
  }
  if (eventType === "order_placed" || eventType === "order_updated") {
    const status = payload.status ? `Status: ${payload.status}` : "Order sent to broker.";
    return status;
  }
  if (eventType === "poll_completed") {
    return "Scheduled monitoring check completed.";
  }
  if (eventType === "agent_paused") return "Monitoring paused.";
  if (eventType === "agent_resumed") return "Monitoring resumed.";
  const summary = Object.entries(payload)
    .filter(([, v]) => v != null && typeof v !== "object")
    .slice(0, 2)
    .map(([k, v]) => `${k.replaceAll("_", " ")}: ${v}`)
    .join(" · ");
  return summary || `Recorded ${type}.`;
}

function Row({
  label,
  value,
  hint,
  tone
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "success";
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">{label}</span>
        <span className={tone === "success" ? "font-medium text-emerald-700" : "font-medium text-right"}>{value}</span>
      </div>
      {hint && <p className="mt-0.5 text-right text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
