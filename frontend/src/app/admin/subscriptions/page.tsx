"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminTable } from "@/components/admin/admin-table";
import { api } from "@/lib/api";

export default function AdminSubscriptionsPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    void api.get<{ items: Record<string, unknown>[] }>("/admin/subscriptions").then((r) => setItems(r.items));
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold">Subscriptions</h2>
      <div className="mt-4">
        <AdminTable
          columns={[
            {
              key: "email",
              label: "User",
              render: (row) => (
                <Link href={`/admin/users/${row.user_id}`} className="text-primary underline">
                  {String(row.email)}
                </Link>
              ),
            },
            { key: "plan", label: "Plan" },
            { key: "status", label: "Status" },
            { key: "razorpay_sub_id", label: "Razorpay ID" },
            { key: "current_period_end", label: "Period end" },
            { key: "created_at", label: "Created" },
          ]}
          rows={items}
        />
      </div>
    </div>
  );
}
