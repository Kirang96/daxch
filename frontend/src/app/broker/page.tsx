"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, PlugZap, RefreshCw, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { AlertBanner, Badge, Disclaimer, GlassCard } from "@/components/daxch/primitives";
import { BrokerFundsCheck } from "@/components/daxch/broker-funds-check";
import { api } from "@/lib/api";
import { BROKER_OAUTH_STATE, encodeBrokerOAuthState } from "@/lib/broker-oauth";
import { formatBrokerName } from "@/lib/broker-status";
import { logger } from "@/lib/logger";

type BrokerStatus = {
  connected: boolean;
  broker?: string;
  expires_at?: string;
  expired?: boolean;
};

type SupportedBroker = {
  id: string;
  name: string;
  description: string;
  available: boolean;
};

export default function BrokerPage() {
  return (
    <Suspense
      fallback={
        <AppShell
          title="Broker connection"
          subtitle="Connect your broker to sync order status and execute trades you approve."
        >
          <GlassCard>
            <p className="text-sm text-muted-foreground">Loading broker status…</p>
          </GlassCard>
        </AppShell>
      }
    >
      <BrokerPageContent />
    </Suspense>
  );
}

function BrokerPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justConnected = searchParams.get("broker") === "connected";
  const [connectedBanner, setConnectedBanner] = useState(false);
  const [status, setStatus] = useState<BrokerStatus | null>(null);
  const [brokers, setBrokers] = useState<SupportedBroker[]>([]);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const checkStatus = async () => {
    try {
      const response = await api.get<BrokerStatus>("/broker/connection-status");
      setStatus(response);
      setMessage("");
    } catch (error) {
      logger.error("Failed to check broker status", { page: "broker", message: (error as Error).message });
      setMessage((error as Error).message);
    }
  };

  useEffect(() => {
    void checkStatus();
    void api
      .get<{ items: SupportedBroker[] }>("/broker/supported")
      .then((response) => setBrokers(response.items))
      .catch((error) => logger.error("Failed to load brokers", { message: (error as Error).message }));
  }, []);

  useEffect(() => {
    if (!justConnected) return;
    setConnectedBanner(true);
    void checkStatus();
    router.replace("/broker", { scroll: false });
  }, [justConnected, router]);

  const connect = async (brokerId: string) => {
    setConnectingId(brokerId);
    setMessage("");
    try {
      const state = encodeBrokerOAuthState(brokerId, BROKER_OAUTH_STATE.APP);
      const response = await api.get<{ url: string }>(`/broker/${brokerId}/auth-url?state=${encodeURIComponent(state)}`);
      if (response.url) {
        window.location.href = response.url;
        return;
      }
      setMessage("Broker auth URL unavailable.");
    } catch (error) {
      setMessage(`Could not connect: ${(error as Error).message}`);
    } finally {
      setConnectingId(null);
    }
  };

  const refreshToken = async () => {
    if (!status?.broker) return;
    try {
      await api.post(`/broker/${status.broker}/refresh`, {});
      setMessage("Token refreshed.");
      await checkStatus();
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const connectedBroker = status?.broker;
  const connectedLabel = connectedBroker ? formatBrokerName(connectedBroker) : "your broker";

  return (
    <AppShell
      title="Broker connection"
      subtitle="Connect your broker to sync order status and execute trades you approve."
    >
      {connectedBanner && status?.connected && !status.expired && (
        <AlertBanner variant="info" className="mb-4" title={`${connectedLabel} connected`}>
          Your broker is linked. You can create agents and place approved trades from the agent pages.
        </AlertBanner>
      )}

      <div className="space-y-4">
        {brokers.map((broker) => {
          const isConnected = status?.connected && connectedBroker === broker.id && !status.expired;
          const isExpired = status?.connected && connectedBroker === broker.id && status.expired;
          const isActiveBroker = connectedBroker === broker.id;

          return (
            <GlassCard key={broker.id}>
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-sm bg-primary/15 text-primary">
                  <PlugZap className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-medium">{broker.name}</h2>
                    {isConnected ? (
                      <Badge variant="success">
                        <Check className="mr-1 h-3 w-3" /> Connected
                      </Badge>
                    ) : isExpired ? (
                      <Badge variant="warning">Session expired</Badge>
                    ) : broker.available ? (
                      <Badge variant="neutral">Available</Badge>
                    ) : (
                      <Badge variant="neutral">Coming soon</Badge>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{broker.description}</p>
                  {isActiveBroker && (
                    <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                      <li className="flex gap-2">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        Sync fill status for exchange trades
                      </li>
                      <li className="flex gap-2">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        Place orders only after you approve AI suggestions
                      </li>
                    </ul>
                  )}
                  <div className="mt-6 flex flex-wrap gap-2">
                    {broker.available && (!status?.connected || isExpired || !isConnected) ? (
                      <button
                        type="button"
                        onClick={() => connect(broker.id)}
                        disabled={connectingId !== null}
                        className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-[oklch(0.15_0_0)] disabled:opacity-60"
                      >
                        {connectingId === broker.id
                          ? "Redirecting…"
                          : isExpired
                            ? `Reconnect ${broker.name}`
                            : `Connect ${broker.name}`}
                      </button>
                    ) : isConnected ? (
                      <Link
                        href="/agents"
                        className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-[oklch(0.15_0_0)]"
                      >
                        View your agents
                      </Link>
                    ) : null}
                    {isActiveBroker && (
                      <button
                        type="button"
                        onClick={() => setShowAdvanced((s) => !s)}
                        className="inline-flex items-center gap-1 rounded-xl border border-border/20 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground"
                      >
                        Advanced{" "}
                        <ChevronDown className={`h-4 w-4 transition ${showAdvanced ? "rotate-180" : ""}`} />
                      </button>
                    )}
                  </div>
                  {isActiveBroker && showAdvanced && (
                    <div className="mt-4 rounded-xl border border-border/15 bg-muted/40 p-4 text-sm">
                      <p className="text-muted-foreground">
                        Broker: {connectedBroker || "—"} · Expires:{" "}
                        {status?.expires_at ? new Date(status.expires_at).toLocaleString() : "—"}
                      </p>
                      <button
                        type="button"
                        onClick={refreshToken}
                        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border/20 px-3 py-1.5 text-xs hover:bg-muted"
                      >
                        <RefreshCw className="h-3 w-3" /> Refresh token
                      </button>
                      {isConnected && <BrokerFundsCheck />}
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {status?.connected && !status.expired && (
        <AlertBanner variant="info" className="mt-4" title="You're all set">
          When an agent suggests a trade, approve it on the agent page — it will appear under Exchange trades.
        </AlertBanner>
      )}

      {message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}

      <div className="mt-8">
        <Disclaimer />
      </div>
    </AppShell>
  );
}
