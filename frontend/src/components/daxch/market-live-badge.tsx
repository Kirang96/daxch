"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

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
  const isPreOpen = status.session === "pre_open";

  return (
    <button
      type="button"
      title={status.detail}
      aria-label={`${status.label}. ${status.detail}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-sm border px-3 py-2.5 text-sm font-medium transition-colors",
        isLive && "border-emerald-600/30 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
        isPreOpen && "border-amber-500/30 bg-amber-50 text-amber-800 hover:bg-amber-100",
        !isLive && !isPreOpen && "border-border/20 bg-background text-muted-foreground hover:bg-muted",
        className
      )}
    >
      <span className="relative inline-flex h-2 w-2 shrink-0">
        {isLive && (
          <span className="absolute inset-0 rounded-full bg-emerald-600 opacity-60 animate-ping" aria-hidden />
        )}
        <span
          className={cn(
            "relative h-2 w-2 rounded-full",
            isLive ? "bg-emerald-600" : isPreOpen ? "bg-amber-500" : "bg-muted-foreground/60"
          )}
          aria-hidden
        />
      </span>
      <Activity
        className={cn("h-3.5 w-3.5", isLive ? "text-emerald-700" : isPreOpen ? "text-amber-600" : "opacity-50")}
        aria-hidden
      />
      <span>{status.label}</span>
    </button>
  );
}
