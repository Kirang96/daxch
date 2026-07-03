"use client";

import { GlassCard } from "@/components/daxch/primitives";

export function AdminTable({
  columns,
  rows,
  emptyLabel = "No records",
}: {
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  emptyLabel?: string;
}) {
  return (
    <GlassCard className="overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border/15 bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="whitespace-nowrap px-4 py-3 font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.id ?? row.user_id ?? i)} className="border-b border-border/10">
              {columns.map((c) => (
                <td key={c.key} className="max-w-xs truncate px-4 py-3 font-mono text-xs">
                  {formatCell(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </GlassCard>
  );
}

function formatCell(value: unknown) {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}
