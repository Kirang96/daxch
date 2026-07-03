"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AdminJsonViewer } from "@/components/admin/admin-json-viewer";
import { AdminSection } from "@/components/admin/admin-section";
import { AdminTable } from "@/components/admin/admin-table";
import { GlassCard } from "@/components/daxch/primitives";
import { api } from "@/lib/api";

type User360 = {
  user: {
    id: string;
    email: string;
    name: string | null;
    plan_tier: string;
    is_active: boolean;
    is_admin: boolean;
    has_password: boolean;
    created_at: string;
  };
  subscription: {
    plan: string;
    status: string;
    razorpay_sub_id: string | null;
    current_period_end: string | null;
    trial_ends_at: string | null;
  } | null;
  subscription_history: Record<string, unknown>[];
  ai_quota: {
    plan_allowance: number;
    plan_consumed: number;
    plan_remaining: number;
    bonus_balance: number;
    total_remaining: number;
    total_used: number;
    percent_used: number;
    has_active_subscription: boolean;
    period_start: string;
    period_end: string;
  };
  ai_usage_events: Record<string, unknown>[];
  ai_usage_summaries: Record<string, unknown>[];
  payments: {
    invoices: Record<string, unknown>[];
    topups: Record<string, unknown>[];
  };
  broker: {
    connected: boolean;
    expired: boolean;
    token_expires_at: string | null;
    broker_name: string;
  } | null;
  settings: Record<string, unknown> | null;
  holdings: Record<string, unknown>[];
  agents: Record<string, unknown>[];
  decisions: Record<string, unknown>[];
  orders: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
  watchlist: Record<string, unknown>[];
  audit_logs: Record<string, unknown>[];
};

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        ok ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-700"
      }`}
    >
      {label}
    </span>
  );
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const userId = String(params.id);
  const [data, setData] = useState<User360 | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void api
      .get<User360>(`/admin/users/${userId}`)
      .then(setData)
      .catch(() => setError("User not found"));
  }, [userId]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading user…</p>;

  const { user, ai_quota, broker } = data;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/users" className="text-sm text-primary underline">
          ← Users
        </Link>
        <h2 className="mt-2 text-xl font-semibold">{user.email}</h2>
        <p className="text-sm text-muted-foreground">
          {user.name ?? "No name"} · {user.plan_tier} · joined {user.created_at}
        </p>
      </div>

      <AdminSection title="Summary" description="Plan, subscription, broker, and AI quota.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <GlassCard className="p-3">
            <div className="text-xs text-muted-foreground">Subscription</div>
            <div className="mt-1 font-medium">{data.subscription?.status ?? "none"}</div>
            <div className="text-xs text-muted-foreground">{data.subscription?.plan ?? "—"}</div>
          </GlassCard>
          <GlassCard className="p-3">
            <div className="text-xs text-muted-foreground">Broker</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {broker ? (
                <>
                  <StatusBadge ok={broker.connected && !broker.expired} label={broker.expired ? "Expired" : "Connected"} />
                  <span className="text-xs text-muted-foreground">{broker.broker_name}</span>
                </>
              ) : (
                <StatusBadge ok={false} label="Not connected" />
              )}
            </div>
          </GlassCard>
          <GlassCard className="p-3">
            <div className="text-xs text-muted-foreground">AI quota</div>
            <div className="mt-1 font-medium tabular-nums">
              {ai_quota.plan_consumed} / {ai_quota.plan_allowance} used
            </div>
            <div className="text-xs text-muted-foreground">{ai_quota.total_remaining} remaining (+{ai_quota.bonus_balance} bonus)</div>
          </GlassCard>
          <GlassCard className="p-3">
            <div className="text-xs text-muted-foreground">Account</div>
            <div className="mt-1 flex flex-wrap gap-1">
              <StatusBadge ok={user.is_active} label={user.is_active ? "Active" : "Inactive"} />
              {user.is_admin && <StatusBadge ok label="Admin" />}
            </div>
          </GlassCard>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.min(100, ai_quota.percent_used)}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Period {ai_quota.period_start} → {ai_quota.period_end}
        </p>
      </AdminSection>

      <AdminSection title="AI usage" description="Current period quota and recent events.">
        <AdminTable
          columns={[
            { key: "operation", label: "Operation" },
            { key: "model", label: "Model" },
            { key: "ticker", label: "Ticker" },
            { key: "units_consumed", label: "Units" },
            { key: "created_at", label: "When" },
          ]}
          rows={data.ai_usage_events}
          emptyLabel="No usage events"
        />
        {data.ai_usage_summaries.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-sm font-medium">Period summaries</h4>
            <AdminTable
              columns={[
                { key: "period_start", label: "Start" },
                { key: "period_end", label: "End" },
                { key: "units_consumed_from_plan", label: "Consumed" },
              ]}
              rows={data.ai_usage_summaries}
            />
          </div>
        )}
      </AdminSection>

      <AdminSection title="Payments" description="Invoices and AI top-ups for this user.">
        <h4 className="mb-2 text-sm font-medium">Invoices</h4>
        <AdminTable
          columns={[
            { key: "invoice_id", label: "Invoice" },
            { key: "plan", label: "Plan" },
            { key: "amount", label: "Amount" },
            { key: "status", label: "Status" },
            { key: "invoice_date", label: "Date" },
          ]}
          rows={data.payments.invoices}
          emptyLabel="No invoices"
        />
        <h4 className="mb-2 mt-4 text-sm font-medium">Top-ups</h4>
        <AdminTable
          columns={[
            { key: "pack_id", label: "Pack" },
            { key: "units_granted", label: "Units" },
            { key: "amount", label: "Amount" },
            { key: "status", label: "Status" },
            { key: "created_at", label: "When" },
          ]}
          rows={data.payments.topups}
          emptyLabel="No top-ups"
        />
      </AdminSection>

      <AdminSection title="Agents & trades" description="Monitor agents, recent decisions, and orders.">
        <AdminTable
          columns={[
            {
              key: "ticker",
              label: "Ticker",
              render: (row) => (
                <Link href={`/admin/agents/${row.id}`} className="text-primary underline">
                  {String(row.ticker)}
                </Link>
              ),
            },
            { key: "status", label: "Status" },
            { key: "polling_frequency", label: "Poll" },
            { key: "next_poll_at", label: "Next poll" },
            { key: "awaiting_entry_fill", label: "Awaiting fill" },
            { key: "entry_order_error", label: "Entry error" },
          ]}
          rows={data.agents}
          emptyLabel="No agents"
        />
        <h4 className="mb-2 mt-4 text-sm font-medium">Recent decisions</h4>
        <AdminTable
          columns={[
            { key: "decision_type", label: "Type" },
            { key: "confirmation_status", label: "Confirmation" },
            { key: "reasoning", label: "Reasoning" },
            { key: "decided_at", label: "When" },
          ]}
          rows={data.decisions}
          emptyLabel="No decisions"
        />
        <h4 className="mb-2 mt-4 text-sm font-medium">Recent orders</h4>
        <AdminTable
          columns={[
            { key: "ticker", label: "Ticker" },
            { key: "status", label: "Status" },
            { key: "broker_status", label: "Broker" },
            { key: "broker_order_id", label: "Broker ID" },
            { key: "filled_quantity", label: "Filled" },
            { key: "created_at", label: "When" },
          ]}
          rows={data.orders}
          emptyLabel="No orders"
        />
      </AdminSection>

      <AdminSection title="Notifications" description="Recent alerts for this user.">
        <AdminTable
          columns={[
            { key: "type", label: "Type" },
            { key: "title", label: "Title" },
            { key: "body", label: "Body" },
            { key: "read_at", label: "Read" },
            { key: "created_at", label: "When" },
          ]}
          rows={data.notifications}
          emptyLabel="No notifications"
        />
      </AdminSection>

      <AdminSection title="Account" description="Settings, watchlist, and holdings.">
        {data.settings && <AdminJsonViewer data={data.settings} label="User settings" />}
        <h4 className="mb-2 mt-4 text-sm font-medium">Holdings</h4>
        <AdminTable
          columns={[
            { key: "ticker", label: "Ticker" },
            { key: "quantity", label: "Qty" },
            { key: "entry_price", label: "Entry" },
            { key: "intention", label: "Intention" },
            { key: "status", label: "Status" },
          ]}
          rows={data.holdings}
          emptyLabel="No holdings"
        />
        <h4 className="mb-2 mt-4 text-sm font-medium">Watchlist</h4>
        <AdminTable
          columns={[
            { key: "ticker", label: "Ticker" },
            { key: "note", label: "Note" },
            { key: "target_price", label: "Target" },
          ]}
          rows={data.watchlist}
          emptyLabel="No watchlist items"
        />
      </AdminSection>

      <AdminSection title="Audit" description="Agent audit log entries for this user.">
        <AdminTable
          columns={[
            { key: "agent_id", label: "Agent" },
            { key: "event_type", label: "Event" },
            { key: "created_at", label: "When" },
            {
              key: "payload",
              label: "Payload",
              render: (row) => <AdminJsonViewer data={row.payload} label="payload" />,
            },
          ]}
          rows={data.audit_logs}
          emptyLabel="No audit logs"
        />
      </AdminSection>

      {data.subscription_history.length > 0 && (
        <AdminSection title="Subscription history">
          <AdminTable
            columns={[
              { key: "plan", label: "Plan" },
              { key: "status", label: "Status" },
              { key: "current_period_end", label: "Period end" },
              { key: "created_at", label: "Created" },
            ]}
            rows={data.subscription_history}
          />
        </AdminSection>
      )}
    </div>
  );
}
