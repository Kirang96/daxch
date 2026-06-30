import { BarChart3, Newspaper, Sparkles } from "lucide-react";

import type { AnalysisStrategyId } from "@/types";

export const STRATEGY_UI: Record<
  AnalysisStrategyId,
  { label: string; description: string; icon: typeof BarChart3 }
> = {
  technical_trend: {
    label: "Technical Trend",
    description: "Price action and technical indicators only — ignores news.",
    icon: BarChart3,
  },
  news_sentiment: {
    label: "News & Sentiment",
    description: "Recent news and public sentiment — ignores chart patterns.",
    icon: Newspaper,
  },
  ai_trade_setup: {
    label: "AI Trade Setup",
    description: "Combines technicals and news for an actionable swing-trade setup.",
    icon: Sparkles,
  },
};

export function formatDecision(decision: string): string {
  if (decision === "dont_enter") return "Don't Enter";
  if (decision === "enter") return "Enter";
  return decision
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function decisionTone(
  decision: string
): "success" | "warning" | "danger" | "neutral" {
  if (decision === "enter" || decision === "buy_more") return "success";
  if (decision === "dont_enter" || decision === "sell") return "danger";
  if (decision === "hold") return "neutral";
  return "warning";
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
