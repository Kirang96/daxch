"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { Badge, Disclaimer, GlassCard } from "@/components/daxch/primitives";
import { Logo } from "@/components/daxch/logo";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { isBrokerHealthy } from "@/lib/broker-status";
import { BROKER_OAUTH_STATE } from "@/lib/broker-oauth";
import { logger } from "@/lib/logger";

const brokers = [
  { name: "Upstox", status: "available", desc: "OAuth · sync orders & execute trades you approve." },
  { name: "Zerodha", status: "soon", desc: "Kite Connect integration in review." },
  { name: "Angel One", status: "soon", desc: "SmartAPI integration on the way." },
  { name: "Groww", status: "soon", desc: "Pending Groww API partnership." }
];

export default function OnboardingBrokerPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState("");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void api
      .get<{ connected: boolean; expired?: boolean }>("/broker/connection-status")
      .then((response) => setConnected(isBrokerHealthy(response)))
      .catch(() => setConnected(false));
  }, [isAuthenticated]);

  const connectUpstox = async () => {
    setConnecting(true);
    setStatus("");
    try {
      const response = await api.get<{ url: string }>(
        `/broker/upstox/auth-url?state=${BROKER_OAUTH_STATE.ONBOARDING}`
      );
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
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="relative mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          <span className="editorial-label text-muted-foreground">Step 2 of 4</span>
        </div>
        <div className="mt-4 h-1 w-full overflow-hidden rounded-sm bg-muted">
          <div className="h-full w-2/4 bg-primary" />
        </div>

        <div className="mt-12 text-center">
          <h1 className="text-balance font-serif text-3xl font-semibold tracking-tight md:text-4xl">Connect your broker</h1>
          <p className="mx-auto mt-3 max-w-xl text-balance text-sm text-muted-foreground">
            Daxch does not trade without your approval. Broker access syncs order status and executes trades you
            confirm. Optional — you can skip and connect later.
          </p>
        </div>

        {connected && (
          <div className="mt-8 rounded-sm border border-primary/30 bg-primary/5 p-4 text-center text-sm">
            <p className="text-foreground">Upstox is already connected.</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
              <Link href="/broker" className="text-xs font-medium text-primary hover:underline">
                Manage in app →
              </Link>
              <Link href="/onboarding/subscription" className="text-xs text-muted-foreground hover:text-foreground">
                Continue to plans →
              </Link>
            </div>
          </div>
        )}

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {brokers.map((broker) => (
            <GlassCard key={broker.name}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-medium">{broker.name}</h3>
                    {broker.status === "available" ? <Badge variant="success">Available</Badge> : <Badge variant="neutral">Coming soon</Badge>}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{broker.desc}</p>
                </div>
              </div>
              <div className="mt-5">
                {broker.status === "available" ? (
                  <button
                    type="button"
                    disabled={connecting}
                    onClick={connectUpstox}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition-colors hover:bg-[oklch(0.15_0_0)] disabled:opacity-60"
                  >
                    {connecting ? "Connecting…" : "Connect"} <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    disabled
                    className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-sm border border-border/15 bg-muted px-4 py-2.5 text-sm text-muted-foreground"
                  >
                    Coming soon
                  </button>
                )}
              </div>
            </GlassCard>
          ))}
        </div>

        {status && <p className="mt-4 text-center text-sm text-red-500">{status}</p>}

        <div className="mt-8 flex items-center justify-between rounded-sm border border-border/15 bg-muted p-4">
          <div className="flex items-center gap-3 text-sm">
            <ShieldCheck className="h-4 w-4 text-primary" />
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
