"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AdminJsonViewer } from "@/components/admin/admin-json-viewer";
import { AdminSection } from "@/components/admin/admin-section";
import { AdminTable } from "@/components/admin/admin-table";
import { api } from "@/lib/api";

type AgentDetail = {
  agent: {
    id: string;
    status: string;
    polling_frequency: string;
    next_poll_at: string | null;
    agent_config: Record<string, unknown>;
    awaiting_entry_fill: boolean;
    entry_order_error: string | null;
  };
  holding: {
    ticker: string;
    exchange: string;
    quantity: number;
    entry_price: number;
    intention: string;
    status: string;
  } | null;
  user: { id: string; email: string; name: string | null } | null;
  decisions: {
    id: string;
    decision_type: string;
    confirmation_status: string;
    reasoning: string;
    decided_at: string;
    confirmed_at: string | null;
    order: Record<string, unknown> | null;
  }[];
  audit_logs: Record<string, unknown>[];
};

export default function AdminAgentDetailPage() {
  const params = useParams();
  const agentId = String(params.id);
  const [data, setData] = useState<AgentDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void api
      .get<AgentDetail>(`/admin/agents/${agentId}`)
      .then(setData)
      .catch(() => setError("Agent not found"));
  }, [agentId]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading agent…</p>;

  const { agent, holding, user } = data;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/agents" className="text-sm text-primary underline">
          ← Agents
        </Link>
        <h2 className="mt-2 text-xl font-semibold">
          {holding?.ticker ?? "Agent"} · {agent.status}
        </h2>
        {user && (
          <p className="text-sm text-muted-foreground">
            User:{" "}
            <Link href={`/admin/users/${user.id}`} className="text-primary underline">
              {user.email}
            </Link>
          </p>
        )}
        {agent.entry_order_error && (
          <p className="mt-1 text-sm text-amber-700">Entry error: {agent.entry_order_error}</p>
        )}
      </div>

      <AdminSection title="Agent config">
        <AdminJsonViewer data={agent.agent_config} label="agent_config" />
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <span className="text-muted-foreground">Polling: </span>
            {agent.polling_frequency}
          </div>
          <div>
            <span className="text-muted-foreground">Next poll: </span>
            {agent.next_poll_at ?? "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Awaiting entry fill: </span>
            {agent.awaiting_entry_fill ? "yes" : "no"}
          </div>
        </div>
      </AdminSection>

      {holding && (
        <AdminSection title="Holding">
          <AdminTable
            columns={[
              { key: "ticker", label: "Ticker" },
              { key: "exchange", label: "Exchange" },
              { key: "quantity", label: "Qty" },
              { key: "entry_price", label: "Entry" },
              { key: "intention", label: "Intention" },
              { key: "status", label: "Status" },
            ]}
            rows={[holding]}
          />
        </AdminSection>
      )}

      <AdminSection title="Decisions timeline" description="All decisions with linked orders.">
        <div className="space-y-4">
          {data.decisions.map((d) => (
            <div key={d.id} className="rounded-lg border border-border/15 p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{d.decision_type}</span>
                <span className="text-muted-foreground">·</span>
                <span>{d.confirmation_status}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">{d.decided_at}</span>
              </div>
              {d.reasoning && <p className="mt-2 text-sm text-muted-foreground">{d.reasoning}</p>}
              {d.order && (
                <div className="mt-3">
                  <h4 className="text-xs font-medium uppercase text-muted-foreground">Order</h4>
                  <AdminTable
                    columns={[
                      { key: "status", label: "Status" },
                      { key: "broker_status", label: "Broker" },
                      { key: "broker_order_id", label: "Broker ID" },
                      { key: "transaction_type", label: "Side" },
                      { key: "quantity", label: "Qty" },
                      { key: "filled_quantity", label: "Filled" },
                      { key: "created_at", label: "Created" },
                    ]}
                    rows={[d.order]}
                  />
                </div>
              )}
            </div>
          ))}
          {!data.decisions.length && <p className="text-sm text-muted-foreground">No decisions yet.</p>}
        </div>
      </AdminSection>

      <AdminSection title="Audit log">
        <AdminTable
          columns={[
            { key: "event_type", label: "Event" },
            { key: "created_at", label: "When" },
            {
              key: "payload",
              label: "Payload",
              render: (row) => <AdminJsonViewer data={row.payload} label="payload" />,
            },
          ]}
          rows={data.audit_logs}
          emptyLabel="No audit entries"
        />
      </AdminSection>
    </div>
  );
}
