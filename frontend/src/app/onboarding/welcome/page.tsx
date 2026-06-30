"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";

import { Badge, Disclaimer, GlassCard } from "@/components/daxch/primitives";
import { Logo } from "@/components/daxch/logo";
import { useAuth } from "@/hooks/useAuth";
import { markWelcomeComplete } from "@/lib/onboarding";

export default function OnboardingWelcomePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  const continueToBroker = () => {
    markWelcomeComplete();
    router.push("/onboarding/broker");
  };

  const skipToPlan = () => {
    markWelcomeComplete();
    router.push("/onboarding/subscription");
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[600px]" style={{ background: "var(--gradient-hero)" }} />
      <div className="relative mx-auto max-w-2xl px-6 py-10">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          <span className="text-xs text-muted-foreground">Step 1 of 4</span>
        </div>
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/5">
          <div className="h-full w-1/4 bg-gradient-to-r from-primary to-emerald-400" />
        </div>

        <div className="mt-12 text-center">
          <Badge variant="primary" className="mx-auto">
            <Sparkles className="mr-1 h-3 w-3" /> Subscription required for agents
          </Badge>
          <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Welcome to Daxch
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-balance text-sm text-muted-foreground">
            AI watches your stocks on your schedule. You approve every trade. Let&apos;s set up your first monitoring
            agent in a few minutes.
          </p>
        </div>

        <GlassCard className="mt-10 space-y-4">
          <h2 className="text-sm font-medium">What happens next</h2>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="font-medium text-primary">1.</span>
              Connect your preferred broker to sync and execute approved trades
            </li>
            <li className="flex gap-3">
              <span className="font-medium text-primary">2.</span>
              Pick a stock and assign a Daxch agent to keep an eye on it
            </li>
            <li className="flex gap-3">
              <span className="font-medium text-primary">3.</span>
              Your agent researches on schedule and does actions whenever required with your permission
            </li>
          </ol>
        </GlassCard>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={continueToBroker}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:brightness-110"
          >
            Connect broker <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={skipToPlan}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border/20 bg-muted px-4 py-3 text-sm font-medium hover:bg-muted/80"
          >
            Skip broker setup
          </button>
        </div>

        <div className="mt-8">
          <Disclaimer />
        </div>
      </div>
    </div>
  );
}
