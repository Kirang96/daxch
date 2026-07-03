"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminTable } from "@/components/admin/admin-table";
import { api } from "@/lib/api";

type Notification = {
  id: string;
  user_id: string;
  email: string;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export default function AdminNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    void api.get<{ items: Notification[] }>("/admin/notifications").then((r) => setItems(r.items));
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold">Notifications</h2>
      <p className="mt-1 text-sm text-muted-foreground">Recent notification events across all users.</p>
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
            { key: "type", label: "Type" },
            { key: "title", label: "Title" },
            { key: "body", label: "Body" },
            { key: "read_at", label: "Read" },
            { key: "created_at", label: "When" },
          ]}
          rows={items}
        />
      </div>
    </div>
  );
}
