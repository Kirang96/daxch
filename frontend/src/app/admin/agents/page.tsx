"use client";

import { useEffect, useState } from "react";

import { GlassCard } from "@/components/daxch/primitives";
import { api } from "@/lib/api";

export default function AdminAgentsPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  useEffect(() => {
    void api.get<{ items: Record<string, unknown>[] }>("/admin/agents").then((r) => setItems(r.items));
  }, []);
  return (
    <div>
      <h2 className="text-xl font-semibold">Agents</h2>
      <GlassCard className="mt-4 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/15 bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              {["ticker", "status", "user_id", "awaiting_entry_fill", "entry_order_error", "polling_frequency"].map((h) => (
                <th key={h} className="px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={String(row.id)} className="border-b border-border/10">
                {["ticker", "status", "user_id", "awaiting_entry_fill", "entry_order_error", "polling_frequency"].map((k) => (
                  <td key={k} className="max-w-xs truncate px-4 py-3 font-mono text-xs">{String(row[k] ?? "—")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
