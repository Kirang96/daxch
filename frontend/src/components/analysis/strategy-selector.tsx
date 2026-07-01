"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

import { Badge, GlassCard } from "@/components/daxch/primitives";
import { STRATEGY_UI } from "@/lib/analysis-strategies";
import { cn } from "@/lib/utils";
import type { AnalysisStrategyId, StrategyMeta } from "@/types";

type StrategySelectorProps = {
  strategies: StrategyMeta[];
  selected: AnalysisStrategyId;
  onSelect: (id: AnalysisStrategyId) => void;
  className?: string;
};

export function StrategySelector({
  strategies,
  selected,
  onSelect,
  className,
}: StrategySelectorProps) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-3", className)}>
      {strategies.map((strategy) => {
        const ui = STRATEGY_UI[strategy.id];
        const Icon = ui.icon;
        const isSelected = selected === strategy.id;
        const locked = !strategy.available;

        return (
          <button
            key={strategy.id}
            type="button"
            disabled={locked}
            onClick={() => !locked && onSelect(strategy.id)}
            className={cn(
              "relative rounded-xl border p-4 text-left transition-colors",
              isSelected
                ? "border-primary/50 bg-primary/10"
                : "border-border/20 bg-muted/60 hover:bg-muted",
              locked && "cursor-not-allowed opacity-60"
            )}
          >
            {locked && (
              <div className="absolute right-3 top-3">
                <Badge variant="warning" className="gap-1 text-[10px]">
                  <Lock className="h-3 w-3" /> Pro
                </Badge>
              </div>
            )}
            <Icon className={cn("h-5 w-5", isSelected ? "text-primary" : "text-muted-foreground")} />
            <div className="mt-2 text-sm font-medium">{ui.label}</div>
            <p className="mt-1 text-xs text-muted-foreground">{ui.description}</p>
            {locked && (
              <Link
                href="/subscription"
                onClick={(e) => e.stopPropagation()}
                className="mt-2 inline-block text-xs text-primary hover:underline"
              >
                Upgrade to Pro
              </Link>
            )}
          </button>
        );
      })}
    </div>
  );
}
