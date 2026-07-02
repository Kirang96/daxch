"use client";

import { useEffect, useState } from "react";

import { GlassCard } from "@/components/daxch/primitives";
import { api } from "@/lib/api";

function AdminTablePage({
  title,
  endpoint,
  columns,
}: {
  title: string;
  endpoint: string;
  columns: { key: string; label: string }[];
}) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    void api.get<{ items: Record<string, unknown>[] }>(endpoint).then((res) => setItems(res.items ?? []));
  }, [endpoint]);

  return (
    <div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <GlassCard className="mt-4 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/15 bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-3 font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row, i) => (
              <tr key={String(row.id ?? i)} className="border-b border-border/10">
                {columns.map((c) => (
                  <td key={c.key} className="max-w-xs truncate px-4 py-3 font-mono text-xs">
                    {String(row[c.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                  No records
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <AdminTablePage
      title="Users"
      endpoint="/admin/users"
      columns={[
        { key: "email", label: "Email" },
        { key: "plan_tier", label: "Plan" },
        { key: "is_active", label: "Active" },
        { key: "is_admin", label: "Admin" },
        { key: "created_at", label: "Created" },
      ]}
    />
  );
}
