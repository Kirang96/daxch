"use client";

import { PLAN_COMPARISON_ROWS, PLAN_ORDER } from "@/lib/plan-features";
import { cn } from "@/lib/utils";

export function PricingComparisonTable({ className }: { className?: string }) {
  return (
    <div className={cn("mt-16 overflow-x-auto", className)}>
      <h3 className="mb-6 text-center text-lg font-medium tracking-tight md:text-xl">Compare plans</h3>
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border/15">
            <th className="px-3 py-3 font-medium text-muted-foreground">Feature</th>
            {PLAN_ORDER.map((id) => (
              <th key={id} className="px-3 py-3 font-medium capitalize">
                {id === "pro" ? "Pro" : id.charAt(0).toUpperCase() + id.slice(1)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PLAN_COMPARISON_ROWS.map((row) => (
            <tr key={row.label} className="border-b border-border/10">
              <td className="px-3 py-3 text-muted-foreground">{row.label}</td>
              <td className="px-3 py-3">{row.starter}</td>
              <td className="px-3 py-3">{row.pro}</td>
              <td className="px-3 py-3">{row.ultra}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
