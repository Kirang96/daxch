"use client";

import { useEffect, useState } from "react";

import { AdminTable } from "@/components/admin/admin-table";
import { api } from "@/lib/api";

type InvoiceRow = {
  id: string;
  email: string;
  type: string;
  plan: string | null;
  amount: number;
  currency: string;
  status: string;
  invoice_id: string;
  invoice_date: string;
  period_start: string | null;
  period_end: string | null;
  download_url: string | null;
};

type TopupRow = {
  id: string;
  email: string;
  type: string;
  pack_id: string;
  units_granted: number;
  amount: number;
  currency: string;
  status: string;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  created_at: string;
  paid_at: string | null;
};

function formatInr(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function AdminPaymentsPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [topups, setTopups] = useState<TopupRow[]>([]);

  useEffect(() => {
    void api
      .get<{ invoices: InvoiceRow[]; topups: TopupRow[] }>("/admin/payments")
      .then((r) => {
        setInvoices(r.invoices);
        setTopups(r.topups);
      });
  }, []);

  const invoiceRows = invoices.map((row) => ({
    ...row,
    amount: formatInr(row.amount),
  }));

  const topupRows = topups.map((row) => ({
    ...row,
    amount: formatInr(row.amount),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Payments</h2>
        <p className="mt-1 text-sm text-muted-foreground">Subscription invoices and AI unit top-ups from Razorpay.</p>
      </div>

      <section>
        <h3 className="text-sm font-medium">Subscription invoices</h3>
        <div className="mt-3">
          <AdminTable
            columns={[
              { key: "email", label: "User" },
              { key: "plan", label: "Plan" },
              { key: "amount", label: "Amount" },
              { key: "status", label: "Status" },
              { key: "invoice_id", label: "Invoice ID" },
              { key: "invoice_date", label: "Date" },
              { key: "period_start", label: "Period start" },
              { key: "period_end", label: "Period end" },
              { key: "download_url", label: "Receipt" },
            ]}
            rows={invoiceRows}
            emptyLabel="No subscription invoices yet"
          />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium">AI unit top-ups</h3>
        <div className="mt-3">
          <AdminTable
            columns={[
              { key: "email", label: "User" },
              { key: "pack_id", label: "Pack" },
              { key: "units_granted", label: "Units" },
              { key: "amount", label: "Amount" },
              { key: "status", label: "Status" },
              { key: "razorpay_payment_id", label: "Payment ID" },
              { key: "razorpay_order_id", label: "Order ID" },
              { key: "paid_at", label: "Paid at" },
              { key: "created_at", label: "Created" },
            ]}
            rows={topupRows}
            emptyLabel="No AI top-up purchases yet"
          />
        </div>
      </section>
    </div>
  );
}
