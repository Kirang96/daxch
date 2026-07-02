"use client";

import Link from "next/link";
import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BarChart3, Bot, Search, ShieldAlert, Loader2 } from "lucide-react";

import { AnalysisResultPanel } from "@/components/analysis/analysis-result-panel";
import { StrategySelector } from "@/components/analysis/strategy-selector";
import { AppShell } from "@/components/layout/app-shell";
import { StockPriceChart } from "@/components/charts/stock-price-chart";
import { Badge, ChartCardHeader, Disclaimer, GlassCard, AlertBanner, TimeframeTabs } from "@/components/daxch/primitives";
import { api } from "@/lib/api";
import { decisionTone, formatConfidence, formatDecision } from "@/lib/analysis-strategies";
import { sliceSeriesByTimeframe } from "@/lib/chart";
import { logger } from "@/lib/logger";
import { formatQuoteSearchError } from "@/lib/stock-quote";
import {
  AnalysisStrategyId,
  ResearchSnapshot,
  StrategyAnalysisResult,
  StrategyListResponse,
  StrategyMeta,
} from "@/types";

const TIMEFRAME_OPTIONS = ["1D", "1W", "1M", "3M", "1Y", "All"] as const;

type QuoteData = { ticker: string; ltp: number; change_percent: number | null };
type ChartTimeframe = (typeof TIMEFRAME_OPTIONS)[number];

const DEFAULT_STRATEGIES: StrategyMeta[] = [
  {
    id: "technical_trend",
    name: "Technical Trend",
    description: "Price action and technical indicators only.",
    min_plan: "starter",
    available: true,
  },
  {
    id: "news_sentiment",
    name: "News & Sentiment",
    description: "Recent news and public sentiment.",
    min_plan: "starter",
    available: true,
  },
  {
    id: "ai_trade_setup",
    name: "AI Trade Setup",
    description: "Combines technicals and news.",
    min_plan: "pro",
    available: false,
  },
];

export default function ResearchPage() {
  return (
    <Suspense fallback={<AppShell title="Research Center" subtitle="Loading..."><p className="text-sm text-muted-foreground">Loading...</p></AppShell>}>
      <ResearchContent />
    </Suspense>
  );
}

function ResearchContent() {
  const searchParams = useSearchParams();
  const [ticker, setTicker] = useState("");
  const [exchange, setExchange] = useState("NSE");
  const [intention, setIntention] = useState("long_term");
  const [capital, setCapital] = useState("100000");
  const [strategies, setStrategies] = useState<StrategyMeta[]>(DEFAULT_STRATEGIES);
  const [selectedStrategy, setSelectedStrategy] = useState<AnalysisStrategyId>("technical_trend");
  const [analysisRuns, setAnalysisRuns] = useState<StrategyAnalysisResult[]>([]);
  const [activeRunId, setActiveRunId] = useState<AnalysisStrategyId | null>(null);
  const [snapshot, setSnapshot] = useState<ResearchSnapshot | null>(null);
  const [liveQuote, setLiveQuote] = useState<QuoteData | null>(null);
  const [chartData, setChartData] = useState<number[]>([]);
  const [chartTimestamps, setChartTimestamps] = useState<string[]>([]);
  const [candleMeta, setCandleMeta] = useState<{ high: number | null; low: number | null }>({ high: null, low: null });
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("1M");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quoteError, setQuoteError] = useState("");

  const displaySeries = useMemo(
    () => sliceSeriesByTimeframe(chartData, chartTimestamps, timeframe),
    [chartData, chartTimestamps, timeframe]
  );
  const activeResult = analysisRuns.find((r) => r.strategy === activeRunId) ?? analysisRuns[analysisRuns.length - 1];

  useEffect(() => {
    api
      .get<StrategyListResponse>("/analysis/strategies")
      .then((data) => {
        setStrategies(data.strategies);
        const firstAvailable = data.strategies.find((s) => s.available);
        if (firstAvailable) setSelectedStrategy(firstAvailable.id);
      })
      .catch(() => setStrategies(DEFAULT_STRATEGIES));
  }, []);

  const searchQuote = async (symbolOverride?: string) => {
    const symbol = (symbolOverride ?? ticker).trim().toUpperCase();
    if (!symbol) {
      setQuoteError("Enter a stock ticker to search.");
      setLiveQuote(null);
      setChartData([]);
    setChartTimestamps([]);
    setCandleMeta({ high: null, low: null });
      setChartTimestamps([]);
      setCandleMeta({ high: null, low: null });
      return;
    }
    setQuoteLoading(true);
    setQuoteError("");
    setSnapshot(null);
    setAnalysisRuns([]);
    setActiveRunId(null);
    try {
      const data = await api.get<QuoteData>(`/stocks/quote/${symbol}?exchange=${exchange}`);
      setLiveQuote(data);
      setTicker(symbol);
      const candles = await api.get<{
        prices: number[];
        timestamps?: string[];
        high?: number | null;
        low?: number | null;
      }>(`/stocks/candles/${symbol}?exchange=${exchange}`);
      if (candles.prices.length === 0) {
        logger.warn("No candle data for ticker", { page: "research", ticker: symbol });
      }
      setChartData(candles.prices);
      setChartTimestamps(candles.timestamps ?? []);
      setCandleMeta({ high: candles.high ?? null, low: candles.low ?? null });
    } catch (err) {
      logger.error("Failed to load quote/candles", { page: "research", ticker: symbol, message: (err as Error).message });
      setQuoteError(formatQuoteSearchError((err as Error).message, symbol, exchange));
      setLiveQuote(null);
      setChartData([]);
    setChartTimestamps([]);
    setCandleMeta({ high: null, low: null });
      setChartTimestamps([]);
      setCandleMeta({ high: null, low: null });
    } finally {
      setQuoteLoading(false);
    }
  };

  useEffect(() => {
    const paramTicker = searchParams.get("ticker");
    if (paramTicker) {
      void searchQuote(paramTicker.toUpperCase());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when URL ticker changes only
  }, [searchParams]);

  const handleTickerChange = (value: string) => {
    setTicker(value.toUpperCase());
    setLiveQuote(null);
    setChartData([]);
    setChartTimestamps([]);
    setCandleMeta({ high: null, low: null });
    setSnapshot(null);
    setAnalysisRuns([]);
    setActiveRunId(null);
    setQuoteError("");
  };

  const handleExchangeChange = (value: string) => {
    setExchange(value);
    setLiveQuote(null);
    setChartData([]);
    setChartTimestamps([]);
    setCandleMeta({ high: null, low: null });
    setSnapshot(null);
    setAnalysisRuns([]);
    setActiveRunId(null);
    setQuoteError("");
  };

  const runResearch = async () => {
    const symbol = ticker.trim().toUpperCase();
    if (!symbol) {
      setError("Search for a stock before running analysis.");
      return;
    }
    if (!liveQuote) {
      setError("Load a live quote with Search before running analysis.");
      return;
    }
    const strategyMeta = strategies.find((s) => s.id === selectedStrategy);
    if (strategyMeta && !strategyMeta.available) {
      setError("This strategy requires a Pro subscription.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        strategy: selectedStrategy,
        intention,
        capital,
        exchange,
      });
      const data = await api.get<ResearchSnapshot>(`/research/${symbol}?${params.toString()}`);
      setSnapshot(data);
      setAnalysisRuns((prev) => {
        const filtered = prev.filter((r) => r.strategy !== data.analysis.strategy);
        return [...filtered, data.analysis];
      });
      setActiveRunId(data.analysis.strategy);
      if (data.ltp) {
        setLiveQuote({ ticker: data.ticker, ltp: data.ltp, change_percent: data.change_percent });
      }
    } catch (err) {
      logger.error("Research request failed", { page: "research", ticker: symbol, message: (err as Error).message });
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const displayPrice = snapshot?.ltp ?? liveQuote?.ltp;
  const displayChange = snapshot?.change_percent ?? liveQuote?.change_percent;
  const displayTicker = snapshot?.ticker ?? liveQuote?.ticker ?? ticker;

  return (
    <AppShell title="Research Center" subtitle="Deep-dive any stock before assigning an AI monitoring agent.">
      {error && <AlertBanner variant="error" className="mb-4">{error}</AlertBanner>}
      <GlassCard>
        <div className="max-w-3xl">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Stock ticker</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={ticker}
                onChange={(event) => handleTickerChange(event.target.value.toUpperCase())}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void searchQuote();
                  }
                }}
                className="h-11 w-full rounded-xl border border-border/20 bg-background pl-10 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="e.g. RELIANCE, INFY, TCS"
              />
            </div>
            <span className="mt-1.5 block text-xs text-muted-foreground">NSE or BSE trading symbol</span>
          </label>

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="mb-1.5 block font-medium text-foreground">Exchange</span>
              <select
                value={exchange}
                onChange={(event) => handleExchangeChange(event.target.value)}
                className="h-10 rounded-xl border border-border/20 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="NSE">NSE</option>
                <option value="BSE">BSE</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => void searchQuote()}
              disabled={quoteLoading || !ticker.trim()}
              className="inline-flex h-10 items-center gap-2 rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-[oklch(0.15_0_0)] disabled:opacity-50"
            >
              {quoteLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" /> Search
                </>
              )}
            </button>
            {displayPrice != null && !quoteLoading && (
              <div className="flex shrink-0 items-baseline gap-2 pb-1">
                <span className="text-2xl font-semibold tracking-tight">₹{displayPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                {displayChange != null && (
                  <span className={`text-sm font-medium ${displayChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {displayChange > 0 ? "+" : ""}{displayChange.toFixed(2)}%
                  </span>
                )}
              </div>
            )}
          </div>

          {quoteError && <AlertBanner variant="error" className="mt-4">{quoteError}</AlertBanner>}

          <div className="mt-6">
            <div className="mb-2 text-sm font-medium text-foreground">Analysis strategy</div>
            <StrategySelector
              strategies={strategies}
              selected={selectedStrategy}
              onSelect={setSelectedStrategy}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-xs text-muted-foreground">
              Goal
              <select
                value={intention}
                onChange={(e) => setIntention(e.target.value)}
                className="mt-1 block h-9 rounded-lg border border-border/20 bg-background px-2 text-sm"
              >
                <option value="long_term">Long term</option>
                <option value="swing">Swing trade</option>
                <option value="dividend">Dividend income</option>
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Capital (₹)
              <input
                type="number"
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                className="mt-1 block h-9 w-32 rounded-lg border border-border/20 bg-background px-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => void runResearch()}
              disabled={loading || !liveQuote}
              className="inline-flex h-9 items-center rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-[oklch(0.15_0_0)] disabled:opacity-50"
            >
              {loading ? "Analyzing…" : "Run Analysis"}
            </button>
            {liveQuote && (
              <Link
                href={`/agents/new?ticker=${encodeURIComponent(ticker.toUpperCase())}`}
                className="inline-flex h-9 items-center gap-2 rounded-sm border border-primary/30 bg-primary/10 px-4 text-sm font-medium text-primary hover:bg-primary/15"
              >
                <Bot className="h-4 w-4" /> Monitor this stock
              </Link>
            )}
          </div>
        </div>
      </GlassCard>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <ChartCardHeader
            title={
              <div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {displayTicker ? displayTicker.toUpperCase() : "—"} · {snapshot?.exchange || exchange}
                </div>
                <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Price and momentum</h2>
                {displayPrice != null ? (
                  <div className="mt-1 flex flex-wrap items-baseline gap-2">
                    <span className="text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
                      ₹{displayPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <Badge variant={(displayChange ?? 0) >= 0 ? "success" : "danger"}>
                      {quoteLoading ? "Searching…" : displayChange != null ? `${displayChange > 0 ? "+" : ""}${displayChange.toFixed(2)}%` : liveQuote ? "0.00%" : "n/a"}
                    </Badge>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Search for a ticker to see price and chart.</p>
                )}
              </div>
            }
            tabs={<TimeframeTabs value={timeframe} onChange={setTimeframe} options={TIMEFRAME_OPTIONS} size="xs" />}
          />
          <div className="mt-5">
            {displaySeries.prices.length >= 2 ? (
              <StockPriceChart
                prices={displaySeries.prices}
                timestamps={displaySeries.timestamps}
                high={candleMeta.high}
                low={candleMeta.low}
                ltp={displayPrice}
                height={250}
                className="md:[&_svg]:h-[250px]"
              />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {quoteError ? "No chart — stock not found." : "Search for a stock to load the chart."}
              </p>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">AI Snapshot</div>
          <h3 className="mt-1 text-lg font-medium">Summary</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            {activeResult?.reasoning || (liveQuote ? "Pick a strategy and run analysis." : "Search for a stock first.")}
          </p>

          <div className="mt-5 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <Metric
              label="Decision"
              value={activeResult ? formatDecision(activeResult.decision_type) : "N/A"}
              tone={activeResult ? decisionTone(activeResult.decision_type) : undefined}
            />
            <Metric label="Confidence" value={activeResult ? formatConfidence(activeResult.confidence) : "N/A"} />
            <Metric
              label="Qty delta"
              value={
                activeResult
                  ? activeResult.quantity_delta > 0
                    ? `+${activeResult.quantity_delta}`
                    : String(activeResult.quantity_delta)
                  : "N/A"
              }
            />
            <Metric
              label="Risk flags"
              value={activeResult?.risk_flags?.length ? String(activeResult.risk_flags.length) : "N/A"}
              tone="warning"
            />
          </div>
        </GlassCard>
      </div>

      {analysisRuns.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium">Analysis results</h3>
            <div className="flex flex-wrap gap-2">
              {analysisRuns.map((run) => (
                <button
                  key={run.strategy}
                  type="button"
                  onClick={() => setActiveRunId(run.strategy)}
                  className={`rounded-lg border px-3 py-1 text-xs font-medium ${
                    (activeRunId ?? activeResult?.strategy) === run.strategy
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border/20 bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {run.strategy.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>
          {activeResult && <AnalysisResultPanel result={activeResult} />}
        </div>
      )}

      <AlertBanner
        className="mt-6"
        variant="warning"
        title={
          <>
            <ShieldAlert className="h-4 w-4" /> Risk note
          </>
        }
      >
        Research output is informational and should be validated against your own risk profile before investment
        actions.
      </AlertBanner>

      {snapshot?.recent_decisions?.length ? (
        <GlassCard className="mt-6">
          <h3 className="text-sm font-medium">Recent decisions for this ticker</h3>
          <div className="mt-3 space-y-2 text-sm">
            {snapshot.recent_decisions.map((decision, index) => (
              <div key={`${decision.decided_at}-${index}`} className="rounded-lg border border-border/15 bg-muted/60 p-3">
                <div className="text-xs text-muted-foreground">{new Date(decision.decided_at).toLocaleString()}</div>
                <div className="font-medium">{decision.decision_type.replace("_", " ")}</div>
                <div className="text-xs text-muted-foreground">{decision.reasoning}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      ) : null}

      <div className="mt-8">
        <Disclaimer />
      </div>
    </AppShell>
  );
}

function Metric({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "danger" | "default" | "neutral";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-400"
      : tone === "warning"
        ? "text-amber-400"
        : tone === "danger"
          ? "text-red-400"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border/15 bg-muted/60 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-medium ${toneClass}`}>{value}</div>
    </div>
  );
}
