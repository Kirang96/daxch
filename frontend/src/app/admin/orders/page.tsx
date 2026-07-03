"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminTable } from "@/components/admin/admin-table";
import { api } from "@/lib/api";

export default function AdminOrdersPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    void api.get<{ items: Record<string, unknown>[] }>("/admin/orders").then((r) => setItems(r.items));
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold">Orders</h2>
      <div className="mt-4">
        <AdminTable
          columns={[
            { key: "ticker", label: "Ticker" },
            { key: "status", label: "Status" },
            { key: "broker_status", label: "Broker status" },
            { key: "broker_order_id", label: "Broker order ID" },
            { key: "transaction_type", label: "Side" },
            { key: "quantity", label: "Qty" },
            { key: "filled_quantity", label: "Filled" },
            {
              key: "email",
              label: "User",
              render: (row) => (
                <Link href={`/admin/users/${row.user_id}`} className="text-primary underline">
                  {String(row.email)}
                </Link>
              ),
            },
            { key: "created_at", label: "When" },
          ]}
          rows={items}
        />
      </div>
    </div>
  );
}
