"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/daxch/primitives";
import { api } from "@/lib/api";

function Table({ title, endpoint, cols }: { title: string; endpoint: string; cols: string[] }) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  useEffect(() => { void api.get<{ items: Record<string, unknown>[] }>(endpoint).then((r) => setItems(r.items)); }, [endpoint]);
  return (
    <div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <GlassCard className="mt-4 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/15 bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>{cols.map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {items.map((row, i) => (
              <tr key={String(row.id ?? i)} className="border-b border-border/10">
                {cols.map((k) => <td key={k} className="max-w-xs truncate px-4 py-3 font-mono text-xs">{String(row[k] ?? "—")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}

export default function AdminOrdersPage() {
  return <Table title="Orders" endpoint="/admin/orders" cols={["ticker", "status", "broker_status", "transaction_type", "quantity", "user_id", "created_at"]} />;
}
