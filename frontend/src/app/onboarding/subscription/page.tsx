"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Sparkles } from "lucide-react";

import { AlertBanner, Badge, Disclaimer, GlassCard } from "@/components/daxch/primitives";
import { Logo } from "@/components/daxch/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { startSubscriptionCheckout } from "@/lib/razorpay-subscription";
import { PlanInfo, Subscription } from "@/types";

const PLAN_FEATURES: Record<string, string[]> = {
  starter: ["3,000 AI Units/month", "Up to 10 agents", "2 analysis strategies", "Buy extra AI Units anytime"],
  pro: ["12,000 AI Units/month", "Unlimited agents", "All 3 analysis strategies", "Buy extra AI Units anytime"],
  ultra: ["35,000 AI Units/month", "Unlimited agents", "Highest priority AI", "Buy extra AI Units anytime"]
};

type PlanId = "starter" | "pro" | "ultra";

export default function OnboardingSubscriptionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center px-6 text-sm text-muted-foreground">
          Loading plans...
        </div>
      }
    >
      <OnboardingSubscriptionContent />
    </Suspense>
  );
}

function OnboardingSubscriptionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const brokerConnected = searchParams.get("broker") === "connected";

  const [current, setCurrent] = useState<Subscription | null>(null);
  const [planMap, setPlanMap] = useState<Record<string, PlanInfo>>({});
  const [status, setStatus] = useState("");
  const [devActivateAvailable, setDevActivateAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    const load = async () => {
      try {
        const [subscription, plans, config] = await Promise.all([
          api.get<Subscription | null>("/subscriptions/current"),
          api.get<Record<string, PlanInfo>>("/subscriptions/plans"),
          api.get<{ dev_activate_available: boolean }>("/subscriptions/config")
        ]);
        setCurrent(subscription);
        setPlanMap(plans);
        setDevActivateAvailable(config.dev_activate_available);
      } catch (error) {
        setStatus((error as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const isActive = current?.status === "active";

  const plans = useMemo(
    () =>
      Object.entries(planMap).map(([id, info]) => ({
        id,
        name: info.name,
        price: `₹${info.price}`,
        desc:
          id === "ultra"
            ? "Maximum AI capacity for power users."
            : id === "pro"
              ? "Unlimited coverage with advanced cadence controls."
              : "For focused portfolios and standard monitoring.",
        features: PLAN_FEATURES[id] ?? [],
        highlighted: id === "pro"
      })),
    [planMap]
  );

  const continueToAgent = () => {
    router.push("/agents/new?onboarding=1");
  };

  const refresh = async () => {
    const subscription = await api.get<Subscription | null>("/subscriptions/current");
    setCurrent(subscription);
  };

  const subscribe = async (plan: PlanId) => {
    try {
      setStatus("");
      const response = await api.post<Subscription>("/subscriptions", { plan });
      await startSubscriptionCheckout(response, plan, refresh, setStatus);
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  const devActivate = async (plan: PlanId) => {
    try {
      setStatus("");
      await api.post<Subscription>("/subscriptions/dev-activate", { plan });
      setStatus(`Dev subscription activated (${plan}).`);
      const subscription = await api.get<Subscription | null>("/subscriptions/current");
      setCurrent(subscription);
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[600px]" style={{ background: "var(--gradient-hero)" }} />
      <div className="relative mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          <span className="text-xs text-muted-foreground">Step 3 of 4</span>
        </div>
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/5">
          <div className="h-full w-3/4 bg-gradient-to-r from-primary to-emerald-400" />
        </div>

        <div className="mt-12 text-center">
          <Badge variant="primary" className="mx-auto">
            <Sparkles className="mr-1 h-3 w-3" /> Subscription required for agents
          </Badge>
          <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight md:text-4xl">Choose your plan</h1>
          <p className="mx-auto mt-3 max-w-xl text-balance text-sm text-muted-foreground">
            Subscribe to create monitoring agents and unlock AI research. You can skip for now and come back later.
          </p>
        </div>

        {brokerConnected && (
          <AlertBanner variant="info" className="mt-8" title="Broker connected">
            Your broker is linked. Pick a plan next, or skip and subscribe when you are ready to activate an agent.
          </AlertBanner>
        )}

        {isActive && (
          <AlertBanner variant="info" className="mt-8" title="Plan active">
            You are on the {(current?.plan || "starter").toUpperCase()} plan. Continue to create your first agent.
          </AlertBanner>
        )}

        {status && <p className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-muted-foreground">{status}</p>}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {loading ? (
            <GlassCard className="md:col-span-2">
              <p className="text-sm text-muted-foreground">Loading plans...</p>
            </GlassCard>
          ) : (
            plans.map((plan) => {
              const isCurrent = isActive && current?.plan?.toLowerCase() === plan.id;
              return (
                <GlassCard key={plan.id} className={plan.highlighted ? "border-primary/40 ring-1 ring-primary/25" : ""}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-medium">{plan.name}</h3>
                    {isCurrent ? <Badge variant="success">Current</Badge> : plan.highlighted ? <Badge variant="primary">Popular</Badge> : null}
                  </div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-semibold tracking-tight">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">/ month</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{plan.desc}</p>
                  <ul className="mt-5 space-y-2 text-sm">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 text-emerald-400" /> {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-6 w-full"
                    variant={plan.highlighted ? "primary" : "secondary"}
                    disabled={isCurrent}
                    onClick={() => !isCurrent && subscribe(plan.id as PlanId)}
                  >
                    {isCurrent ? "Current plan" : `Subscribe to ${plan.name}`}
                  </Button>
                  {devActivateAvailable && !isCurrent && (
                    <Button className="mt-2 w-full" variant="secondary" onClick={() => devActivate(plan.id as PlanId)}>
                      Activate {plan.name} (dev only)
                    </Button>
                  )}
                </GlassCard>
              );
            })
          )}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={continueToAgent}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:brightness-110"
          >
            {isActive ? "Create your first agent" : "Skip for now"} <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-8">
          <Disclaimer />
        </div>
      </div>
    </div>
  );
}
