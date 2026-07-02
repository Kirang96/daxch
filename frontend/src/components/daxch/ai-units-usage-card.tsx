"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { GlassCard } from "@/components/daxch/primitives";
import { api } from "@/lib/api";
import { formatAiUnits, formatPercentUsed } from "@/lib/ai-units";
import { cn } from "@/lib/utils";
import { AiUnitsEstimate, AiUnitsQuota, TopupPack, TopupPurchase } from "@/types";

type Props = {
  variant?: "dashboard" | "subscription";
  quota?: AiUnitsQuota | null;
  estimate?: AiUnitsEstimate | null;
  showTopup?: boolean;
  onRefresh?: () => void;
  className?: string;
};

export function AiUnitsUsageCard({
  variant = "dashboard",
  quota: quotaProp,
  estimate: estimateProp,
  showTopup = false,
  onRefresh,
  className
}: Props) {
  const [quota, setQuota] = useState<AiUnitsQuota | null>(quotaProp ?? null);
  const [estimate, setEstimate] = useState<AiUnitsEstimate | null>(estimateProp ?? null);
  const [packs, setPacks] = useState<TopupPack[]>([]);
  const [purchases, setPurchases] = useState<TopupPurchase[]>([]);
  const [loading, setLoading] = useState(!quotaProp);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [quotaData, estimateData] = await Promise.all([
        quotaProp ? Promise.resolve(quotaProp) : api.get<AiUnitsQuota>("/ai-units/current").catch(() => null),
        estimateProp !== undefined
          ? Promise.resolve(estimateProp)
          : api.get<AiUnitsEstimate>("/ai-units/estimate/portfolio").catch(() => null)
      ]);
      setQuota(quotaData);
      setEstimate(estimateData);
      if (showTopup) {
        const [packData, purchaseData] = await Promise.all([
          api.get<TopupPack[]>("/ai-units/topup-packs"),
          api.get<TopupPurchase[]>("/ai-units/purchases").catch(() => [] as TopupPurchase[])
        ]);
        setPacks(packData);
        setPurchases(purchaseData);
      } else {
        setPacks([]);
        setPurchases([]);
      }
      onRefresh?.();
    } catch {
      setQuota(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!quotaProp) {
      void load();
    }
  }, [quotaProp, showTopup]);

  const buyPack = async (packId: string) => {
    try {
      setMessage("");
      const order = await api.post<{ order_id: string; amount: number; key_id: string; purchase_id: string }>(
        "/ai-units/topup",
        { pack_id: packId }
      );
      if (typeof window !== "undefined" && (window as unknown as { Razorpay?: unknown }).Razorpay) {
        const Razorpay = (window as unknown as { Razorpay: new (opts: Record<string, unknown>) => { open: () => void } })
          .Razorpay;
        const rzp = new Razorpay({
          key: order.key_id,
          amount: order.amount,
          currency: "INR",
          name: "Daxch",
          description: "AI Units top-up",
          order_id: order.order_id,
          handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            await api.post("/ai-units/topup/confirm", {
              order_id: response.razorpay_order_id,
              payment_id: response.razorpay_payment_id,
              signature: response.razorpay_signature
            });
            setMessage("Top-up successful. Units added to your balance.");
            await load();
          }
        });
        rzp.open();
        return;
      }
      if (process.env.NODE_ENV === "development") {
        await api.post("/ai-units/topup/dev-credit", { pack_id: packId });
        setMessage("Dev top-up credited.");
        await load();
        return;
      }
      setMessage("Payment gateway unavailable. Try again later.");
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const cardClass = cn(variant === "dashboard" ? "mt-6" : "", className);

  if (loading) {
    if (variant === "subscription") {
      return (
        <div className={cn("grid gap-4 lg:grid-cols-2 lg:gap-6", className)}>
          <GlassCard className="p-5">
            <div className="text-sm text-muted-foreground">Loading usage…</div>
          </GlassCard>
          {showTopup && (
            <GlassCard className="p-5">
              <div className="text-sm text-muted-foreground">Loading top-up packs…</div>
            </GlassCard>
          )}
        </div>
      );
    }
    if (variant === "dashboard") {
      return (
        <GlassCard className={cn("mt-6 max-w-md", className)}>
          <div className="text-sm text-muted-foreground">Loading AI Units…</div>
        </GlassCard>
      );
    }
    return (
      <GlassCard className={cardClass}>
        <div className="text-sm text-muted-foreground">Loading AI Units usage…</div>
      </GlassCard>
    );
  }

  if (!quota && !showTopup) {
    return (
      <GlassCard className={cn(cardClass, variant === "dashboard" && "max-w-md")}>
        <div className="text-sm font-medium">AI Units</div>
        <p className="mt-2 text-sm text-muted-foreground">Subscribe to get a monthly AI Units allowance.</p>
        <Link href="/subscription" className="mt-3 inline-block text-sm text-primary hover:underline">
          View plans
        </Link>
      </GlassCard>
    );
  }

  const pct = quota ? formatPercentUsed(quota.percent_used) : 0;
  const barColor = pct >= 95 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-primary";
  const resetDate = quota ? new Date(quota.period_end).toLocaleDateString() : "—";

  const usageBlock = quota ? (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Remaining</div>
          <div className="mt-1 text-3xl font-semibold tracking-tight">{formatAiUnits(quota.total_remaining)}</div>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <div>{pct}% used</div>
          <div className="mt-0.5">Resets {resetDate}</div>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/20 bg-background px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Plan</div>
          <div className="mt-0.5 text-sm font-medium">{formatAiUnits(quota.plan_remaining)}</div>
        </div>
        <div className="rounded-xl border border-border/20 bg-background px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Bonus</div>
          <div className="mt-0.5 text-sm font-medium">{formatAiUnits(quota.bonus_balance)}</div>
        </div>
      </div>

      {estimate && estimate.estimated_monthly_units > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          ~{formatAiUnits(estimate.estimated_monthly_units)}/mo estimated for monitoring
        </p>
      )}

      {quota.total_remaining === 0 && (
        <p className="mt-3 text-sm text-red-400">Units exhausted — top up or wait for renewal.</p>
      )}
    </>
  ) : (
    <p className="text-sm text-muted-foreground">Usage details unavailable. You can still buy top-up packs.</p>
  );

  const topupBlock = showTopup ? (
  <div id="top-up-packs">
      <p className="text-sm text-muted-foreground">
        Bonus units roll over and are used after your monthly allowance.
      </p>
      <div className="mt-4 space-y-2">
        {packs.map((pack) => (
          <button
            key={pack.id}
            type="button"
            onClick={() => buyPack(pack.id)}
            className="flex w-full items-center justify-between gap-4 rounded-xl border border-border/20 bg-background px-4 py-3 text-left transition hover:border-primary/30 hover:bg-muted"
          >
            <div className="min-w-0">
              <div className="font-medium">{pack.label}</div>
              <div className="text-xs text-muted-foreground">{formatAiUnits(pack.units)} units</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-semibold">₹{pack.price_inr}</div>
              <div className="text-[10px] text-primary">Buy</div>
            </div>
          </button>
        ))}
      </div>
      {packs.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">Top-up packs could not be loaded.</p>
      )}
      {purchases.length > 0 && (
        <div className="mt-4 border-t border-border/20 pt-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Recent</div>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {purchases.slice(0, 3).map((p) => (
              <li key={p.id}>
                {formatAiUnits(p.units_granted)} · ₹{p.amount_inr} · {p.status}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  ) : null;

  if (variant === "subscription") {
    return (
      <div className={cn("grid gap-4 lg:grid-cols-2 lg:gap-6", className)} id={showTopup ? "top-up" : undefined}>
        <GlassCard className="p-5">
          <div className="text-sm font-semibold tracking-tight">This billing cycle</div>
          <div className="mt-4">{usageBlock}</div>
        </GlassCard>

        {showTopup ? (
          <GlassCard className="p-5">
            <div className="text-sm font-semibold tracking-tight">Buy more units</div>
            {topupBlock}
          </GlassCard>
        ) : (
          <GlassCard className="flex flex-col justify-center p-5">
            <div className="text-sm font-semibold tracking-tight">Top-up packs</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Subscribe to a plan to unlock one-time AI Unit top-ups mid-cycle.
            </p>
          </GlassCard>
        )}

        {message && (
          <p className="text-sm text-muted-foreground lg:col-span-2">{message}</p>
        )}
      </div>
    );
  }

  if (variant === "dashboard") {
    const pct = quota ? formatPercentUsed(quota.percent_used) : 0;
    const barColor =
      pct >= 95 ? "bg-[color:var(--destructive)]" : pct >= 80 ? "bg-[color:oklch(0.62_0.14_55)]" : "bg-[color:var(--forest)]";

    return (
      <div className={cn(className)}>
        <div className="mb-2 flex items-center gap-2">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-[color:var(--ink-2)]/70">
            AI Units
          </span>
        </div>
        {quota ? (
          <>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-mono text-4xl tracking-tight text-[color:var(--ink)]">
                {formatAiUnits(quota.total_remaining)}
              </span>
              <span className="font-mono text-sm text-[color:var(--ink-2)]/60">
                / {formatAiUnits(quota.total_limit)}
              </span>
            </div>
            <div className="mt-3 h-2 w-full border border-[color:var(--ink)]/20 bg-[color:var(--paper-2)]">
              <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-3 text-xs italic leading-relaxed text-[color:var(--ink-2)]/80">
              {pct >= 80
                ? "Usage is high — top up to keep monitoring uninterrupted."
                : `${pct}% used this billing cycle.`}
            </p>
            <Link
              href="/subscription#top-up"
              className="mt-5 flex items-center justify-between border-t border-[color:var(--ink)]/15 pt-4 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[color:var(--forest)] hover:text-[color:var(--ink)]"
            >
              <span>Top up AI Units</span>
              <span>→</span>
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-[color:var(--ink-2)]/80">Subscribe to get a monthly AI Units allowance.</p>
            <Link
              href="/subscription"
              className="mt-4 inline-block font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[color:var(--forest)] hover:text-[color:var(--ink)]"
            >
              View plans →
            </Link>
          </>
        )}
        {message && <p className="mt-3 text-sm text-[color:var(--ink-2)]/70">{message}</p>}
      </div>
    );
  }

  return (
    <GlassCard className={cardClass} id={showTopup ? "top-up" : undefined}>
      {quota ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">AI Units</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">
                {formatAiUnits(quota.total_remaining)}{" "}
                <span className="text-base font-normal text-muted-foreground">remaining</span>
              </div>
            </div>
            {pct >= 80 && showTopup && (
              <a href="#top-up-packs" className="text-sm font-medium text-amber-400 hover:underline">
                Buy more units
              </a>
            )}
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{formatAiUnits(quota.plan_remaining)} plan remaining</span>
            <span>{formatAiUnits(quota.bonus_balance)} bonus balance</span>
            <span>Resets {resetDate}</span>
          </div>

          {estimate && estimate.estimated_monthly_units > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              ~{formatAiUnits(estimate.estimated_monthly_units)} units/month estimated for active monitoring
            </p>
          )}

          {quota.total_remaining === 0 && (
            <p className="mt-2 text-sm text-red-400">
              AI Units exhausted. Monitoring may pause until you top up or your plan renews.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Usage details unavailable right now. You can still buy top-up packs below.</p>
      )}

      {showTopup && (
        <div id="top-up-packs" className={cn(quota ? "mt-6 border-t border-border/20 pt-6" : "")}>
          <div className="text-sm font-semibold tracking-tight">Buy more AI Units</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Top-up units roll over in your bonus wallet and are used after your monthly plan allowance.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {packs.map((pack) => (
              <button
                key={pack.id}
                type="button"
                onClick={() => buyPack(pack.id)}
                className="rounded-xl border border-border/20 bg-background p-4 text-left transition hover:border-primary/30 hover:bg-muted"
              >
                <div className="font-medium">{pack.label}</div>
                <div className="mt-1 text-sm text-muted-foreground">{formatAiUnits(pack.units)} units</div>
                <div className="mt-2 text-lg font-semibold">₹{pack.price_inr}</div>
              </button>
            ))}
          </div>
          {packs.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">Top-up packs could not be loaded. Refresh the page to try again.</p>
          )}
          {purchases.length > 0 && (
            <div className="mt-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Recent top-ups</div>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {purchases.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    {formatAiUnits(p.units_granted)} units · ₹{p.amount_inr} · {p.status}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
    </GlassCard>
  );
}
