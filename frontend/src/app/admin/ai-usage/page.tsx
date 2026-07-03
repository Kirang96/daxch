"use client";

import { useEffect, useState } from "react";

import { AdminTable } from "@/components/admin/admin-table";
import { api } from "@/lib/api";

type UserUsage = {
  user_id: string;
  email: string;
  name: string | null;
  plan_tier: string;
  subscription_status: string | null;
  plan_allowance: number;
  plan_consumed: number;
  bonus_balance: number;
  total_remaining: number;
  percent_used: number;
  period_start: string;
  period_end: string;
  events_in_period: number;
};

type UsageEvent = {
  id: string;
  user_id: string;
  email: string;
  operation: string;
  model: string;
  ticker: string | null;
  units_consumed: number;
  created_at: string;
};

export default function AdminAiUsagePage() {
  const [tab, setTab] = useState<"by-user" | "events">("by-user");
  const [search, setSearch] = useState("");
  const [byUser, setByUser] = useState<UserUsage[]>([]);
  const [events, setEvents] = useState<UsageEvent[]>([]);

  useEffect(() => {
    if (tab !== "by-user") return;
    const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
    void api.get<{ items: UserUsage[] }>(`/admin/ai-usage/by-user${query}`).then((r) => setByUser(r.items));
  }, [tab, search]);

  useEffect(() => {
    if (tab !== "events") return;
    void api.get<{ items: UsageEvent[] }>("/admin/ai-usage").then((r) => setEvents(r.items));
  }, [tab]);

  return (
    <div>
      <h2 className="text-xl font-semibold">AI usage</h2>
      <p className="mt-1 text-sm text-muted-foreground">Per-user quotas for the current billing period and recent events.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("by-user")}
          className={`rounded-lg px-3 py-1.5 text-sm ${tab === "by-user" ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted"}`}
        >
          By user
        </button>
        <button
          type="button"
          onClick={() => setTab("events")}
          className={`rounded-lg px-3 py-1.5 text-sm ${tab === "events" ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted"}`}
        >
          Recent events
        </button>
      </div>

      {tab === "by-user" && (
        <div className="mt-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email…"
            className="mb-4 h-10 w-full max-w-sm rounded-lg border border-border/20 bg-background px-3 text-sm"
          />
          <AdminTable
            columns={[
              { key: "email", label: "User" },
              { key: "plan_tier", label: "Plan" },
              { key: "subscription_status", label: "Sub status" },
              { key: "plan_consumed", label: "Used" },
              { key: "plan_allowance", label: "Allowance" },
              { key: "bonus_balance", label: "Bonus" },
              { key: "total_remaining", label: "Remaining" },
              { key: "percent_used", label: "% used" },
              { key: "events_in_period", label: "Events" },
              { key: "period_end", label: "Period ends" },
            ]}
            rows={byUser}
          />
        </div>
      )}

      {tab === "events" && (
        <div className="mt-4">
          <AdminTable
            columns={[
              { key: "email", label: "User" },
              { key: "operation", label: "Operation" },
              { key: "model", label: "Model" },
              { key: "ticker", label: "Ticker" },
              { key: "units_consumed", label: "Units" },
              { key: "created_at", label: "When" },
            ]}
            rows={events}
          />
        </div>
      )}
    </div>
  );
}
