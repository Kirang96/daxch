"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminTable } from "@/components/admin/admin-table";
import { api } from "@/lib/api";

type UserRow = {
  id: string;
  email: string;
  plan_tier: string;
  is_active: boolean;
  is_admin: boolean;
  subscription_status: string | null;
  broker_connected: boolean;
  broker_expired: boolean;
  created_at: string;
};

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
    void api.get<{ items: UserRow[]; total: number }>(`/admin/users${query}`).then((res) => {
      setItems(res.items);
      setTotal(res.total);
    });
  }, [search]);

  return (
    <div>
      <h2 className="text-xl font-semibold">Users</h2>
      <p className="mt-1 text-sm text-muted-foreground">{total} users</p>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by email…"
        className="mt-4 h-10 w-full max-w-sm rounded-lg border border-border/20 bg-background px-3 text-sm"
      />
      <div className="mt-4">
        <AdminTable
          columns={[
            {
              key: "email",
              label: "Email",
              render: (row) => (
                <Link href={`/admin/users/${row.id}`} className="text-primary underline">
                  {String(row.email)}
                </Link>
              ),
            },
            { key: "plan_tier", label: "Plan" },
            { key: "subscription_status", label: "Sub status" },
            { key: "broker_connected", label: "Broker" },
            { key: "broker_expired", label: "Expired" },
            { key: "is_active", label: "Active" },
            { key: "is_admin", label: "Admin" },
            { key: "created_at", label: "Created" },
          ]}
          rows={items}
        />
      </div>
    </div>
  );
}
