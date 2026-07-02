"use client";

import { useEffect, useState } from "react";

import { GlassCard } from "@/components/daxch/primitives";
import { api } from "@/lib/api";

type Overview = {
  users: number;
  agents: number;
  active_agents: number;
  failed_orders_24h: number;
  webhook_events: number;
  ai_units_consumed_24h: number;
};

export default function AdminOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    void api.get<Overview>("/admin/overview").then(setData);
  }, []);

  if (!data) return <p className="text-sm text-muted-foreground">Loading overview…</p>;

  const tiles = [
    { label: "Users", value: data.users },
    { label: "Agents", value: data.agents },
    { label: "Active agents", value: data.active_agents },
    { label: "Failed orders (24h)", value: data.failed_orders_24h },
    { label: "Webhook events", value: data.webhook_events },
    { label: "AI units (24h)", value: data.ai_units_consumed_24h },
  ];

  return (
    <div>
      <h2 className="text-xl font-semibold">Overview</h2>
      <p className="mt-1 text-sm text-muted-foreground">Platform health at a glance.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <GlassCard key={t.label} className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{t.label}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{t.value}</div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
