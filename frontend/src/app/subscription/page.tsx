"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";

import { AiUnitsUsageCard } from "@/components/daxch/ai-units-usage-card";
import { PlanFeaturesList } from "@/components/daxch/plan-features-list";
import { AppShell } from "@/components/layout/app-shell";
import { AlertBanner, Badge, Disclaimer, GlassCard, StatCard } from "@/components/daxch/primitives";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { buildPlanCardFromApi, type PlanId } from "@/lib/plan-features";
import { startSubscriptionCheckout, finalizeSubscriptionReturn, refreshPendingSubscription, syncSubscriptionStatus } from "@/lib/razorpay-subscription";
import { Invoice, PlanInfo, Subscription } from "@/types";

const PLAN_IDS: PlanId[] = ["starter", "pro", "ultra"];

export default function SubscriptionPage() {
  const [current, setCurrent] = useState<Subscription | null>(null);
  const [planMap, setPlanMap] = useState<Record<string, PlanInfo>>({});
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [status, setStatus] = useState("");
  const [devActivateAvailable, setDevActivateAvailable] = useState(false);

  const refresh = async () => {
    try {
      const [subscription, invoiceData, plans, config] = await Promise.all([
        api.get<Subscription | null>("/subscriptions/current"),
        api.get<Invoice[]>("/subscriptions/invoices"),
        api.get<Record<string, PlanInfo>>("/subscriptions/plans"),
        api.get<{ dev_activate_available: boolean }>("/subscriptions/config")
      ]);
      setCurrent(subscription);
      setInvoices(invoiceData);
      setPlanMap(plans);
      setDevActivateAvailable(config.dev_activate_available);
      setStatus("");
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  const subscribe = async (plan: PlanId) => {
    try {
      const response = await api.post<Subscription>("/subscriptions", { plan });
      await startSubscriptionCheckout(response, plan, refresh, setStatus);
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  const devActivate = async (plan: PlanId) => {
    try {
      await api.post<Subscription>("/subscriptions/dev-activate", { plan });
      setStatus(`Dev subscription activated (${plan}).`);
      await refresh();
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  useEffect(() => {
    const load = async () => {
      await refresh();
      await finalizeSubscriptionReturn(refresh, setStatus);
      const subscription = await api.get<Subscription | null>("/subscriptions/current");
      await refreshPendingSubscription(subscription, refresh);
    };
    void load();
  }, []);

  const isActive = current?.status === "active";

  const plans = useMemo(
    () =>
      Object.entries(planMap)
        .sort(([a], [b]) => PLAN_IDS.indexOf(a as PlanId) - PLAN_IDS.indexOf(b as PlanId))
        .map(([id, info]) => buildPlanCardFromApi(id, info)),
    [planMap]
  );

  const statusLabel = (current?.status ?? "none").toUpperCase();
  const renewalLabel = current?.current_period_end
    ? new Date(current.current_period_end).toLocaleDateString()
    : "—";

  return (
    <AppShell title="Subscription" subtitle="Manage plan entitlements, billing status, and invoices.">
      {!isActive && (
        <AlertBanner variant="warning" className="mb-4" title="No active subscription">
          Subscribe below to create agents and use monitoring. Checkout is processed securely via Razorpay.
        </AlertBanner>
      )}
      {status && <p className="mb-4 rounded-xl border border-border/20 bg-background p-3 text-sm text-muted-foreground">{status}</p>}
      {!isActive && current?.provider_subscription_id && (
        <div className="mb-4">
          <Button
            variant="secondary"
            onClick={async () => {
              setStatus("Checking payment status with Razorpay...");
              try {
                await syncSubscriptionStatus();
                await refresh();
                setStatus("Subscription status updated.");
              } catch (error) {
                setStatus((error as Error).message);
              }
            }}
          >
            Refresh payment status
          </Button>
        </div>
      )}

      <div className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Current Plan" value={(current?.plan || "—").toUpperCase()} hint={isActive ? "billed monthly" : "subscribe to unlock"} />
          <StatCard
            label="Status"
            value={statusLabel}
            delta={isActive ? "paid" : "action needed"}
            trend={isActive ? "up" : "flat"}
          />
          <StatCard label="Renewal" value={renewalLabel} hint={isActive ? "current cycle end" : "after you subscribe"} />
        </div>

        <section id="top-up">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">AI Units</h2>
          <AiUnitsUsageCard variant="subscription" showTopup={isActive} />
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Plans</h2>
          <div className="grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = isActive && current?.plan?.toLowerCase() === plan.id;
              return (
                <GlassCard
                  key={plan.id}
                  className={`flex h-full flex-col ${plan.highlighted ? "border-primary/40 ring-1 ring-primary/25" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-medium">{plan.name}</h3>
                    {isCurrent ? <Badge variant="success">Current</Badge> : plan.highlighted ? <Badge variant="primary">Popular</Badge> : null}
                  </div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-semibold tracking-tight">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">/ month</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{plan.desc}</p>
                  <PlanFeaturesList features={plan.features} className="mt-5 flex-1" />
                  <div className="mt-6 space-y-2">
                    <Button
                      className="w-full"
                      variant={plan.highlighted ? "primary" : "secondary"}
                      disabled={isCurrent}
                      onClick={() => !isCurrent && subscribe(plan.id as PlanId)}
                    >
                      {isCurrent ? "Current plan" : `Subscribe to ${plan.name}`}
                    </Button>
                    {devActivateAvailable && !isCurrent && (
                      <Button className="w-full" variant="secondary" onClick={() => devActivate(plan.id as PlanId)}>
                        Activate {plan.name} (dev only)
                      </Button>
                    )}
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </section>

        <GlassCard className="overflow-hidden p-0">
        <div className="border-b border-border/15 px-4 py-4 text-sm font-medium sm:px-6">Invoices</div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto sm:block">
          <div className="min-w-[520px]">
            <div className="grid grid-cols-[1.1fr_1fr_1fr_auto] gap-3 border-b border-border/15 px-6 py-3 text-[11px] uppercase tracking-wider text-muted-foreground">
              <span>Invoice</span>
              <span>Date</span>
              <span>Amount</span>
              <span />
            </div>
            {invoices.map((invoice) => (
              <div key={invoice.id} className="grid grid-cols-[1.1fr_1fr_1fr_auto] items-center gap-3 border-b border-border/15 px-6 py-3 text-sm">
                <span className="font-mono text-xs">{invoice.invoice_id}</span>
                <span className="text-muted-foreground">{new Date(invoice.invoice_date).toLocaleDateString()}</span>
                <span className="tabular-nums">
                  {invoice.currency} {invoice.amount.toFixed(2)}
                </span>
                {invoice.download_url ? (
                  <a
                    href={invoice.download_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-border/20 bg-background px-2.5 py-1.5 text-xs hover:bg-muted"
                  >
                    <Download className="h-3.5 w-3.5" /> PDF
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">N/A</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Mobile cards */}
        <div className="divide-y divide-border/15 sm:hidden">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="space-y-2 px-4 py-3 text-sm">
              <div className="font-mono text-xs break-all">{invoice.invoice_id}</div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{new Date(invoice.invoice_date).toLocaleDateString()}</span>
                <span className="font-medium tabular-nums">
                  {invoice.currency} {invoice.amount.toFixed(2)}
                </span>
              </div>
              {invoice.download_url ? (
                <a
                  href={invoice.download_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-border/20 bg-background px-2.5 py-1.5 text-xs hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" /> Download PDF
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">PDF unavailable</span>
              )}
            </div>
          ))}
        </div>

        {invoices.length === 0 && (
          <div className="px-4 py-3 text-sm text-muted-foreground sm:px-6">No invoices yet.</div>
        )}
        </GlassCard>

        <p className="text-xs text-muted-foreground">
          Payments processed securely via Razorpay. Daxch does not store card details.{" "}
          <Link href="/refund-policy" className="underline-offset-4 hover:underline">
            Refund Policy
          </Link>
          {" · "}
          <Link href="/cancellation-policy" className="underline-offset-4 hover:underline">
            Cancellation Policy
          </Link>
        </p>
      </div>

      <div className="mt-8">
        <Disclaimer />
      </div>
    </AppShell>
  );
}
