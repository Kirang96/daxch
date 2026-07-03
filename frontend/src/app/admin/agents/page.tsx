"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminTable } from "@/components/admin/admin-table";
import { api } from "@/lib/api";

export default function AdminAgentsPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    void api.get<{ items: Record<string, unknown>[] }>("/admin/agents").then((r) => setItems(r.items));
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold">Agents</h2>
      <div className="mt-4">
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
            {
              key: "user_email",
              label: "User",
              render: (row) => (
                <Link href={`/admin/users/${row.user_id}`} className="text-primary underline">
                  {String(row.user_email)}
                </Link>
              ),
            },
            { key: "awaiting_entry_fill", label: "Awaiting fill" },
            { key: "entry_order_error", label: "Entry error" },
            { key: "polling_frequency", label: "Poll" },
            { key: "next_poll_at", label: "Next poll" },
          ]}
          rows={items}
        />
      </div>
    </div>
  );
}
