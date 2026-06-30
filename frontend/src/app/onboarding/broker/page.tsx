"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { Badge, Disclaimer, GlassCard } from "@/components/daxch/primitives";
import { Logo } from "@/components/daxch/logo";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";

const brokers = [
  { name: "Upstox", status: "available", desc: "OAuth · sync orders & execute trades you approve.", color: "from-violet-500/30 to-primary/20" },
  { name: "Zerodha", status: "soon", desc: "Kite Connect integration in review.", color: "from-amber-500/20 to-red-500/10" },
  { name: "Angel One", status: "soon", desc: "SmartAPI integration on the way.", color: "from-sky-500/20 to-primary/10" },
  { name: "Groww", status: "soon", desc: "Pending Groww API partnership.", color: "from-emerald-500/20 to-emerald-500/5" }
];

export default function OnboardingBrokerPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  const connectUpstox = async () => {
    setConnecting(true);
    setStatus("");
    try {
      const response = await api.get<{ url: string }>("/broker/upstox/auth-url?state=onboarding");
      if (response.url) {
        window.location.href = response.url;
        return;
      }
      setStatus("Could not start Upstox connection. Try again from Settings.");
    } catch (error) {
      logger.error("Onboarding broker connect failed", { message: (error as Error).message });
      setStatus((error as Error).message);
    } finally {
      setConnecting(false);
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
          <span className="text-xs text-muted-foreground">Step 2 of 4</span>
        </div>
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/5">
          <div className="h-full w-2/4 bg-gradient-to-r from-primary to-emerald-400" />
        </div>

        <div className="mt-12 text-center">
          <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Connect your broker
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-balance text-sm text-muted-foreground">
            Daxch does not trade without your approval. Broker access syncs order status and executes trades you
            confirm. Optional — you can skip and connect later.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {brokers.map((broker) => (
            <GlassCard key={broker.name} className="relative overflow-hidden">
              <div aria-hidden className={`absolute inset-0 bg-gradient-to-br ${broker.color} opacity-50`} />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-medium">{broker.name}</h3>
                    {broker.status === "available" ? <Badge variant="success">Available</Badge> : <Badge variant="neutral">Coming soon</Badge>}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{broker.desc}</p>
                </div>
              </div>
              <div className="relative mt-5">
                {broker.status === "available" ? (
                  <button
                    type="button"
                    disabled={connecting}
                    onClick={connectUpstox}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-60"
                  >
                    {connecting ? "Connecting…" : "Connect"} <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    disabled
                    className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm text-muted-foreground"
                  >
                    Coming soon
                  </button>
                )}
              </div>
            </GlassCard>
          ))}
        </div>

        {status && <p className="mt-4 text-center text-sm text-red-500">{status}</p>}

        <div className="mt-8 flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-center gap-3 text-sm">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span className="text-muted-foreground">Secure OAuth · you approve every trade</span>
          </div>
          <Link href="/onboarding/subscription" className="text-xs text-muted-foreground hover:text-foreground">
            Skip for now →
          </Link>
        </div>
        <div className="mt-8">
          <Disclaimer />
        </div>
      </div>
    </div>
  );
}
