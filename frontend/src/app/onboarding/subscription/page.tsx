"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";

import { AlertBanner, Badge, Disclaimer, GlassCard } from "@/components/daxch/primitives";
import { PlanFeaturesList } from "@/components/daxch/plan-features-list";
import { Logo } from "@/components/daxch/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { buildPlanCardFromApi, getPlanCtaState, isPlanId, type PlanId, PLAN_ORDER } from "@/lib/plan-features";
import { startSubscriptionCheckout, finalizeSubscriptionReturn, refreshPendingSubscription } from "@/lib/razorpay-subscription";
import { PlanInfo, Subscription } from "@/types";

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
  const [subscribingPlan, setSubscribingPlan] = useState<PlanId | null>(null);

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
        await finalizeSubscriptionReturn(refresh, setStatus);
        await refreshPendingSubscription(subscription, refresh);
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
      Object.entries(planMap)
        .sort(([a], [b]) => PLAN_ORDER.indexOf(a as PlanId) - PLAN_ORDER.indexOf(b as PlanId))
        .map(([id, info]) => buildPlanCardFromApi(id, info)),
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
      setSubscribingPlan(plan);
      setStatus("");
      const response = await api.post<Subscription>("/subscriptions", { plan });
      const result = await startSubscriptionCheckout(response, plan, refresh, setStatus, () => setSubscribingPlan(null));
      if (result === "failed") {
        setSubscribingPlan(null);
      }
    } catch (error) {
      setStatus((error as Error).message);
      setSubscribingPlan(null);
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
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="relative mx-auto max-w-7xl px-6 py-10 md:px-10">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          <span className="editorial-label text-muted-foreground">Step 3 of 4</span>
        </div>
        <div className="mt-4 h-1 w-full overflow-hidden rounded-sm bg-muted">
          <div className="h-full w-3/4 bg-primary" />
        </div>

        <div className="mt-12 text-center">
          <Badge variant="primary" className="mx-auto">
            <Sparkles className="mr-1 h-3 w-3" /> Subscription required for agents
          </Badge>
          <h1 className="mt-4 text-balance font-serif text-3xl font-semibold tracking-tight md:text-4xl">Choose your plan</h1>
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

        {status && (
          <AlertBanner variant="warning" className="mt-6" title="Subscription">
            {status}
          </AlertBanner>
        )}

        <div className="mt-10 grid gap-6 sm:grid-cols-1 lg:grid-cols-3 lg:gap-8">
          {loading ? (
            <GlassCard className="p-8 lg:col-span-3">
              <p className="text-sm text-muted-foreground">Loading plans...</p>
            </GlassCard>
          ) : (
            plans.map((plan) => {
              const planId = plan.id as PlanId;
              const currentPlan = isPlanId(current?.plan?.toLowerCase() ?? "") ? (current!.plan.toLowerCase() as PlanId) : null;
              const ctaState = getPlanCtaState(currentPlan, planId, isActive);
              return (
                <GlassCard
                  key={plan.id}
                  className={`flex h-full flex-col p-8 md:p-10 ${plan.highlighted ? "border-primary ring-1 ring-primary/25" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-xl font-medium">{plan.name}</h3>
                    {ctaState === "current" ? <Badge variant="success">Current</Badge> : plan.highlighted ? <Badge variant="primary">Popular</Badge> : null}
                  </div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-mono text-3xl font-semibold tracking-tight">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">/ month</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{plan.desc}</p>
                  <PlanFeaturesList features={plan.features} className="mt-6 flex-1" itemClassName="leading-relaxed" />
                  {ctaState === "included" ? (
                    <p className="mt-8 rounded-xl border border-border/15 bg-muted/60 px-4 py-3 text-center text-sm text-muted-foreground">
                      Included in your plan
                    </p>
                  ) : (
                    <Button
                      className="mt-8 w-full"
                      variant={plan.highlighted ? "primary" : "secondary"}
                      disabled={ctaState === "current" || subscribingPlan !== null}
                      onClick={() => ctaState !== "current" && subscribe(planId)}
                    >
                      {subscribingPlan === planId
                        ? "Opening checkout…"
                        : ctaState === "current"
                          ? "Current plan"
                          : ctaState === "upgrade"
                            ? `Upgrade to ${plan.name}`
                            : `Subscribe to ${plan.name}`}
                    </Button>
                  )}
                  {devActivateAvailable && ctaState !== "current" && ctaState !== "included" && (
                    <Button className="mt-2 w-full" variant="secondary" onClick={() => devActivate(planId)}>
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
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-sm bg-primary px-4 py-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition-colors hover:bg-[oklch(0.15_0_0)]"
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
