"use client";

import { useEffect, useState } from "react";

import { getNseMarketStatus, MarketStatus } from "@/lib/market-hours";
import { cn } from "@/lib/utils";

export function MarketLiveBadge({ className }: { className?: string }) {
  const [status, setStatus] = useState<MarketStatus>(() => getNseMarketStatus());

  useEffect(() => {
    const refresh = () => setStatus(getNseMarketStatus());
    refresh();
    const id = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const isLive = status.session === "live";

  return (
    <div
      title={status.detail}
      aria-label={`${status.label}. ${status.detail}`}
      className={cn(
        "inline-flex items-center gap-2 border border-[color:var(--ink)]/15 bg-[color:var(--paper-3)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em]",
        className
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isLive ? "pulse-ring bg-[color:var(--forest)]" : "bg-[color:var(--ink-2)]/40"
        )}
      />
      <span className="text-[color:var(--ink-2)]/70">NSE</span>
      <span className="font-semibold text-[color:var(--ink)]">{status.label}</span>
    </div>
  );
}
