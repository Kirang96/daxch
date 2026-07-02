"use client";
import { useEffect, useState } from "react";
import { GlassCard } from "@/components/daxch/primitives";
import { api } from "@/lib/api";

export default function AdminWebhooksPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  useEffect(() => { void api.get<{ items: Record<string, unknown>[] }>("/admin/webhooks").then((r) => setItems(r.items)); }, []);
  return (
    <div>
      <h2 className="text-xl font-semibold">Webhooks</h2>
      <GlassCard className="mt-4 overflow-x-auto p-0">
        <table className="w-full text-sm"><thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{["source", "event_hash", "created_at"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
        <tbody>{items.map((row) => <tr key={String(row.id)} className="border-b">{["source", "event_hash", "created_at"].map((k) => <td key={k} className="px-4 py-3 font-mono text-xs">{String(row[k] ?? "—")}</td>)}</tr>)}</tbody></table>
      </GlassCard>
    </div>
  );
}
