"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { Badge, Disclaimer, GlassCard } from "@/components/daxch/primitives";
import { Logo } from "@/components/daxch/logo";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { formatBrokerName, isBrokerHealthy } from "@/lib/broker-status";
import { BROKER_OAUTH_STATE, encodeBrokerOAuthState } from "@/lib/broker-oauth";
import { logger } from "@/lib/logger";

type SupportedBroker = {
  id: string;
  name: string;
  description: string;
  available: boolean;
};

export default function OnboardingBrokerPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [connected, setConnected] = useState(false);
  const [connectedBroker, setConnectedBroker] = useState<string | undefined>();
  const [brokers, setBrokers] = useState<SupportedBroker[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void api
      .get<{ items: SupportedBroker[] }>("/broker/supported")
      .then((response) => setBrokers(response.items))
      .catch(() => setBrokers([]));
    void api
      .get<{ connected: boolean; expired?: boolean; broker?: string }>("/broker/connection-status")
      .then((response) => {
        setConnected(isBrokerHealthy(response));
        setConnectedBroker(response.broker);
      })
      .catch(() => setConnected(false));
  }, [isAuthenticated]);

  const connectBroker = async (brokerId: string) => {
    setConnectingId(brokerId);
    setStatus("");
    try {
      const state = encodeBrokerOAuthState(brokerId, BROKER_OAUTH_STATE.ONBOARDING);
      const response = await api.get<{ url: string }>(
        `/broker/${brokerId}/auth-url?state=${encodeURIComponent(state)}`
      );
      if (response.url) {
        window.location.href = response.url;
        return;
      }
      setStatus("Could not start broker connection. Try again from Settings.");
    } catch (error) {
      logger.error("Onboarding broker connect failed", { message: (error as Error).message });
      setStatus((error as Error).message);
    } finally {
      setConnectingId(null);
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
          <h1 className="text-balance font-serif text-3xl font-semibold tracking-tight md:text-4xl">
            Connect your broker
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-balance text-sm text-muted-foreground">
            Daxch does not trade without your approval. Broker access syncs order status and executes trades you
            confirm. Optional — you can skip and connect later.
          </p>
        </div>

        {connected && (
          <div className="mt-8 rounded-sm border border-primary/30 bg-primary/5 p-4 text-center text-sm">
            <p className="text-foreground">{formatBrokerName(connectedBroker)} is already connected.</p>
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
            <GlassCard key={broker.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-medium">{broker.name}</h3>
                    {broker.available ? (
                      <Badge variant="success">Available</Badge>
                    ) : (
                      <Badge variant="neutral">Coming soon</Badge>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{broker.description}</p>
                </div>
              </div>
              <div className="mt-5">
                {broker.available ? (
                  <button
                    type="button"
                    disabled={connectingId !== null}
                    onClick={() => connectBroker(broker.id)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition-colors hover:bg-[oklch(0.15_0_0)] disabled:opacity-60"
                  >
                    {connectingId === broker.id ? "Connecting…" : "Connect"} <ArrowRight className="h-4 w-4" />
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
