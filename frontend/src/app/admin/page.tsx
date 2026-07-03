"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminSearchBar } from "@/components/admin/admin-search-bar";
import { GlassCard } from "@/components/daxch/primitives";
import { api } from "@/lib/api";

type Overview = {
  users: number;
  agents: number;
  active_agents: number;
  failed_orders_24h: number;
  webhook_events: number;
  ai_units_consumed_24h: number;
  expired_brokers: number;
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
    { label: "Expired brokers", value: data.expired_brokers },
    { label: "Webhook events", value: data.webhook_events },
    { label: "AI units (24h)", value: data.ai_units_consumed_24h },
  ];

  return (
    <div>
      <h2 className="text-xl font-semibold">Overview</h2>
      <p className="mt-1 text-sm text-muted-foreground">Platform health at a glance.</p>

      <GlassCard className="mt-6 p-4">
        <h3 className="text-sm font-medium">Search user by email</h3>
        <p className="mt-1 text-xs text-muted-foreground">Jump straight to a user&apos;s 360° support view.</p>
        <div className="mt-3">
          <AdminSearchBar />
        </div>
      </GlassCard>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <GlassCard key={t.label} className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{t.label}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{t.value}</div>
          </GlassCard>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link href="/admin/users" className="text-primary underline">
          All users
        </Link>
        <Link href="/admin/orders" className="text-primary underline">
          Orders
        </Link>
        <Link href="/admin/notifications" className="text-primary underline">
          Notifications
        </Link>
      </div>
    </div>
  );
}
