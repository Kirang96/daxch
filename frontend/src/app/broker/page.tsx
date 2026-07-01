"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, PlugZap, RefreshCw, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { AlertBanner, Badge, Disclaimer, GlassCard } from "@/components/daxch/primitives";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";

type BrokerStatus = {
  connected: boolean;
  broker?: string;
  expires_at?: string;
  expired?: boolean;
};

export default function BrokerPage() {
  const [status, setStatus] = useState<BrokerStatus | null>(null);
  const [connecting, setConnecting] = useState(false);
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
    checkStatus();
  }, []);

  const connect = async () => {
    setConnecting(true);
    setMessage("");
    try {
      const response = await api.get<{ url: string }>("/broker/upstox/auth-url?state=broker-setup");
      if (response.url) {
        window.location.href = response.url;
        return;
      }
      setMessage("Broker auth URL unavailable.");
    } catch (error) {
      setMessage(`Could not connect: ${(error as Error).message}`);
    } finally {
      setConnecting(false);
    }
  };

  const refreshToken = async () => {
    try {
      await api.post("/broker/upstox/refresh", {});
      setMessage("Token refreshed.");
      await checkStatus();
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  return (
    <AppShell
      title="Broker connection"
      subtitle="Connect Upstox to sync order status and execute trades you approve."
    >
      <GlassCard>
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <PlugZap className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-medium">Upstox</h2>
              {status?.connected && !status.expired ? (
                <Badge variant="success">
                  <Check className="mr-1 h-3 w-3" /> Connected
                </Badge>
              ) : status?.connected && status.expired ? (
                <Badge variant="warning">Session expired</Badge>
              ) : (
                <Badge variant="neutral">Not connected</Badge>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Daxch uses secure OAuth. We never trade without your approval. Revoke access anytime from Upstox or here.
            </p>
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
            <div className="mt-6 flex flex-wrap gap-2">
              {!status?.connected || status.expired ? (
                <button
                  type="button"
                  onClick={connect}
                  disabled={connecting}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-60"
                >
                  {connecting ? "Redirecting…" : status?.expired ? "Reconnect Upstox" : "Connect Upstox"}
                </button>
              ) : (
                <Link
                  href="/agents"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110"
                >
                  View your agents
                </Link>
              )}
              <button
                type="button"
                onClick={() => setShowAdvanced((s) => !s)}
                className="inline-flex items-center gap-1 rounded-xl border border-border/20 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Advanced <ChevronDown className={`h-4 w-4 transition ${showAdvanced ? "rotate-180" : ""}`} />
              </button>
            </div>
            {showAdvanced && (
              <div className="mt-4 rounded-xl border border-border/15 bg-muted/40 p-4 text-sm">
                <p className="text-muted-foreground">
                  Broker: {status?.broker || "—"} · Expires: {status?.expires_at ? new Date(status.expires_at).toLocaleString() : "—"}
                </p>
                <button
                  type="button"
                  onClick={refreshToken}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border/20 px-3 py-1.5 text-xs hover:bg-muted"
                >
                  <RefreshCw className="h-3 w-3" /> Refresh token
                </button>
              </div>
            )}
          </div>
        </div>
      </GlassCard>

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
