"use client";

import { AlertTriangle } from "lucide-react";

import { AlertBanner, Badge, GlassCard } from "@/components/daxch/primitives";
import {
  decisionTone,
  formatConfidence,
  formatDecision,
  STRATEGY_UI,
} from "@/lib/analysis-strategies";
import type { StrategyAnalysisResult } from "@/types";

type AnalysisResultPanelProps = {
  result: StrategyAnalysisResult;
  className?: string;
};

export function AnalysisResultPanel({ result, className }: AnalysisResultPanelProps) {
  const ui = STRATEGY_UI[result.strategy];
  const parseFailed = Boolean(result.metadata?.parse_failed);

  return (
    <GlassCard className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{ui.label}</div>
          <h3 className="mt-1 text-lg font-semibold">{result.ticker}</h3>
        </div>
        <Badge variant={decisionTone(result.decision_type)}>
          {formatDecision(result.decision_type)}
        </Badge>
      </div>

      {parseFailed && (
        <AlertBanner variant="warning" className="mt-4" title="Limited analysis">
          AI response could not be fully parsed — showing a safe fallback. Try running again.
        </AlertBanner>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <Metric label="Confidence" value={formatConfidence(result.confidence)} />
        <Metric
          label="Suggested qty"
          value={result.quantity_delta > 0 ? `+${result.quantity_delta}` : String(result.quantity_delta)}
        />
        <Metric label="Risk flags" value={result.risk_flags.length ? String(result.risk_flags.length) : "None"} />
      </div>

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{result.reasoning}</p>

      {result.risk_flags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {result.risk_flags.map((flag) => (
            <span
              key={flag}
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-200"
            >
              <AlertTriangle className="h-3 w-3" />
              {flag.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      {result.disclaimer && (
        <p className="mt-4 text-xs text-amber-800">{result.disclaimer}</p>
      )}
    </GlassCard>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/15 bg-muted/60 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
