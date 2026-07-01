"use client";

import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  Building2,
  Calendar,
  Check,
  Clock,
  Coins,
  Globe,
  Loader2,
  Mail,
  MessageSquare,
  Newspaper,
  PenLine,
  Scale,
  Search,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Sprout,
  TrendingUp,
  Wallet,
  Info
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { AnalysisResultPanel } from "@/components/analysis/analysis-result-panel";
import { StrategySelector } from "@/components/analysis/strategy-selector";
import { AppShell } from "@/components/layout/app-shell";
import { Badge, Disclaimer, GlassCard, ThinkingDots, AlertBanner } from "@/components/daxch/primitives";
import { api, ApiError } from "@/lib/api";
import { logger } from "@/lib/logger";
import { markWelcomeComplete } from "@/lib/onboarding";
import { formatAiUnits } from "@/lib/ai-units";
import { formatQuoteSearchError } from "@/lib/stock-quote";
import {
  clampPollingFrequency,
  describePollingFrequency,
  canAdoptFrequency,
  maxPollingForPlan
} from "@/lib/polling-frequency";
import { MonitorAgent, StockHolding, Subscription, StrategyAnalysisResult, StrategyListResponse, StrategyMeta, AnalysisStrategyId } from "@/types";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4 | 5;

const steps = [
  { n: 1, label: "Stock" },
  { n: 2, label: "Goal" },
  { n: 3, label: "Investment" },
  { n: 4, label: "AI Assessment" },
  { n: 5, label: "Configure" }
];

type PlannedTradeSnapshot = { entry: string; quantity: string };
type Choice = "user" | "ai";

const DEFAULT_STRATEGIES: StrategyMeta[] = [
  { id: "technical_trend", name: "Technical Trend", description: "", min_plan: "starter", available: true },
  { id: "news_sentiment", name: "News & Sentiment", description: "", min_plan: "starter", available: true },
  { id: "ai_trade_setup", name: "AI Trade Setup", description: "", min_plan: "pro", available: false },
];

export default function NewAgentPage() {
  return (
    <Suspense fallback={<AppShell title="Create monitoring agent" subtitle="Loading..."><p className="text-sm text-muted-foreground">Loading...</p></AppShell>}>
      <NewAgentWizard />
    </Suspense>
  );
}

function NewAgentWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>(1);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [aiUnitsExhausted, setAiUnitsExhausted] = useState(false);
  const [quoteError, setQuoteError] = useState("");

  const [ticker, setTicker] = useState("");
  const [exchange, setExchange] = useState("NSE");
  const [quote, setQuote] = useState<{ ticker: string; name?: string | null; ltp: number; change_percent: number | null } | null>(null);

  const [entryPrice, setEntryPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [pollingFrequency, setPollingFrequency] = useState("2");

  const [intention, setIntention] = useState("long_term");
  const [thesis, setThesis] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyPush, setNotifyPush] = useState(true);
  const [notifySms, setNotifySms] = useState(false);
  const [autoSuggestions, setAutoSuggestions] = useState(true);
  const isOnboarding = searchParams.get("onboarding") === "1";
  const brokerJustConnected = searchParams.get("broker") === "connected";

  const [analysisRuns, setAnalysisRuns] = useState<StrategyAnalysisResult[]>([]);
  const [activeAnalysisId, setActiveAnalysisId] = useState<AnalysisStrategyId | null>(null);
  const [strategies, setStrategies] = useState<StrategyMeta[]>(DEFAULT_STRATEGIES);
  const [selectedStrategy, setSelectedStrategy] = useState<AnalysisStrategyId>("technical_trend");
  const [plannedTrade, setPlannedTrade] = useState<PlannedTradeSnapshot | null>(null);
  const [userFrequencySnapshot, setUserFrequencySnapshot] = useState("2");
  const [entryChoice, setEntryChoice] = useState<Choice>("user");
  const [frequencyChoice, setFrequencyChoice] = useState<Choice>("user");
  const [planTier, setPlanTier] = useState("starter");
  const [agentMonthlyEstimate, setAgentMonthlyEstimate] = useState<number | null>(null);

  useEffect(() => {
    const paramTicker = searchParams.get("ticker");
    if (paramTicker) {
      setTicker(paramTicker.toUpperCase());
    }
  }, [searchParams]);

  useEffect(() => {
    api
      .get<Subscription | null>("/subscriptions/current")
      .then((sub) => setPlanTier(sub?.plan?.toLowerCase() || "starter"))
      .catch(() => setPlanTier("starter"));
  }, []);

  useEffect(() => {
    const freq = clampPollingFrequency(Number(pollingFrequency));
    if (freq < 2) return;
    api
      .get<{ estimated_monthly_units: number }>(`/ai-units/estimate/agent?frequency=${freq}`)
      .then((data) => setAgentMonthlyEstimate(data.estimated_monthly_units))
      .catch(() => setAgentMonthlyEstimate(null));
  }, [pollingFrequency]);

  useEffect(() => {
    api
      .get<StrategyListResponse>("/analysis/strategies")
      .then((data) => {
        setStrategies(data.strategies);
        const first = data.strategies.find((s) => s.available);
        if (first) setSelectedStrategy(first.id);
      })
      .catch(() => setStrategies(DEFAULT_STRATEGIES));
  }, []);

  const next = () => setStep((s) => Math.min(5, s + 1) as Step);
  const prev = () => setStep((s) => Math.max(1, s - 1) as Step);

  const loadQuote = async (): Promise<{
    quote: { ticker: string; name?: string | null; ltp: number; change_percent: number | null } | null;
    error?: string;
  }> => {
    const symbol = ticker.trim().toUpperCase();
    if (!symbol) {
      const message = "Enter a stock ticker to search.";
      setQuoteError(message);
      setQuote(null);
      return { quote: null, error: message };
    }
    try {
      setLoadingQuote(true);
      setQuoteError("");
      setError("");
      const result = await api.get<{ ticker: string; ltp: number; change_percent: number | null }>(
        `/stocks/quote/${symbol}?exchange=${exchange}`
      );
      setQuote(result);
      setEntryPrice(String(result.ltp.toFixed(2)));
      return { quote: result };
    } catch (err) {
      const message = formatQuoteSearchError((err as Error).message, symbol, exchange);
      setQuote(null);
      setQuoteError(message);
      return { quote: null, error: message };
    } finally {
      setLoadingQuote(false);
    }
  };

  const handleTickerChange = (value: string) => {
    setTicker(value.toUpperCase());
    setQuote(null);
    setQuoteError("");
  };

  const handleExchangeChange = (value: string) => {
    setExchange(value);
    setQuote(null);
    setQuoteError("");
  };

  const runAnalysis = async () => {
    const entry = Number(entryPrice);
    const qty = Number(quantity);
    if (!entry || !qty) {
      setError("Enter entry price and quantity to continue.");
      return;
    }
    const freq = clampPollingFrequency(Number(pollingFrequency));
    if (!freq) {
      setError("Enter monitoring checks per trading day (2–12).");
      return;
    }
    const strategyMeta = strategies.find((s) => s.id === selectedStrategy);
    if (strategyMeta && !strategyMeta.available) {
      setError("This strategy requires a Pro subscription.");
      return;
    }
    try {
      setError("");
      setAiUnitsExhausted(false);
      let activeQuote = quote;
      if (!activeQuote) {
        const loaded = await loadQuote();
        activeQuote = loaded.quote;
        if (!activeQuote) {
          setError(loaded.error || "Search for a stock quote before running analysis.");
          return;
        }
      }
      setGenerating(true);
      setPlannedTrade({ entry: entryPrice, quantity });
      setUserFrequencySnapshot(String(freq));
      setEntryChoice("user");
      setFrequencyChoice("user");
      const params = new URLSearchParams({
        strategy: selectedStrategy,
        intention,
        exchange,
        quantity: String(qty),
        entry_price: String(entry),
        polling_frequency: String(freq),
      });
      const result = await api.post<{ analysis: StrategyAnalysisResult }>(
        `/analysis/${ticker.toUpperCase()}?${params.toString()}`,
        {}
      );
      setAnalysisRuns((prev) => {
        const filtered = prev.filter((r) => r.strategy !== result.analysis.strategy);
        return [...filtered, result.analysis];
      });
      setActiveAnalysisId(result.analysis.strategy);
      next();
    } catch (err) {
      if (err instanceof ApiError && err.code === "AI_UNITS_EXHAUSTED") {
        setAiUnitsExhausted(true);
        setError(err.message || "You've used all your AI Units for this billing period.");
      } else {
        setAiUnitsExhausted(false);
        setError((err as Error).message);
      }
    } finally {
      setGenerating(false);
    }
  };

  const activateAgent = async () => {
    setGenerating(true);
    try {
      setSubmitting(true);
      setError("");
      const intentionWithThesis = thesis.trim()
        ? `${intention} | thesis: ${thesis.trim()}`
        : intention;

      const created = await api.post<StockHolding>("/stocks", {
        ticker: ticker.toUpperCase(),
        exchange: exchange.toUpperCase(),
        entry_price: Number(entryPrice),
        quantity: Number(quantity),
        intention: intentionWithThesis,
        enable_monitor_agent: true,
        polling_frequency: Number(pollingFrequency)
      });

      try {
        const settings = await api.get<import("@/types").UserSettings>("/settings");
        await api.patch("/settings/preferences", {
          notification_preferences: {
            ...settings.notification_preferences,
            agent_conclusion_updates: notifyEmail || notifyPush,
            daily_digest_email: notifyEmail,
            sms_critical_alerts: notifySms,
            auto_action_suggestions: autoSuggestions
          },
          security_preferences: settings.security_preferences,
          api_connections: settings.api_connections
        });
      } catch (err) {
        logger.warn("Failed to persist notification preferences", {
          page: "agents/new",
          message: (err as Error).message
        });
      }

      const agents = await api.get<MonitorAgent[]>("/agents");
      const createdAgent = agents.find((agent) => agent.holding_id === created.id);
      if (createdAgent) {
        if (isOnboarding) markWelcomeComplete();
        router.push(`/agents/${createdAgent.id}`);
      } else {
        router.push("/agents");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
      setGenerating(false);
    }
  };

  const applyAssessmentChoicesAndContinue = () => {
    const activeResult =
      analysisRuns.find((r) => r.strategy === activeAnalysisId) ??
      analysisRuns[analysisRuns.length - 1];

    if (entryChoice === "ai" && activeResult?.suggested_entry != null) {
      setEntryPrice(String(activeResult.suggested_entry));
    } else if (plannedTrade) {
      setEntryPrice(plannedTrade.entry);
    }

    if (frequencyChoice === "ai" && activeResult?.suggested_polling_frequency != null) {
      const adoptable = Math.min(
        activeResult.suggested_polling_frequency,
        activeResult.max_adoptable_polling_frequency ?? maxPollingForPlan(planTier)
      );
      setPollingFrequency(String(adoptable));
    } else {
      setPollingFrequency(userFrequencySnapshot);
    }
    next();
  };

  const maxPlanFrequency = maxPollingForPlan(planTier);

  return (
    <AppShell
      title={isOnboarding ? "Create your first agent" : "Create monitoring agent"}
      subtitle={isOnboarding ? "Step 4 of 4 — pick a stock and set your planned investment." : "Five steps. You stay in control throughout."}
    >
      {isOnboarding && (
        <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-white/5">
          <div className="h-full w-full bg-gradient-to-r from-primary to-emerald-400" />
        </div>
      )}
      {brokerJustConnected && (
        <AlertBanner variant="info" className="mb-4" title="Upstox connected">
          You can approve trades on this agent once the AI suggests an action.
        </AlertBanner>
      )}
      {error && (
        <AlertBanner variant="error" className="mb-4">
          {error}
          {aiUnitsExhausted && (
            <>
              {" "}
              <Link href="/subscription#top-up" className="font-medium text-primary underline">
                Buy more AI Units
              </Link>
            </>
          )}
        </AlertBanner>
      )}
      <div className="mb-8 -mx-1 overflow-x-auto px-1">
        <div className="grid min-w-[28rem] grid-cols-5 gap-2 sm:min-w-0">
          {steps.map((s) => (
            <div key={s.n}>
              <div className={cn("h-1 rounded-full", step >= (s.n as Step) ? "bg-gradient-to-r from-primary to-emerald-400" : "bg-white/5")} />
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-medium",
                    step >= (s.n as Step) ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground"
                  )}
                >
                  {step > s.n ? <Check className="h-3 w-3" /> : s.n}
                </span>
                <span className={cn("hidden truncate sm:inline", step === s.n ? "font-medium text-foreground" : "text-muted-foreground")}>{s.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {step === 1 && (
        <Step1Stock
          ticker={ticker}
          exchange={exchange}
          quote={quote}
          loadingQuote={loadingQuote}
          quoteError={quoteError}
          onTickerChange={handleTickerChange}
          onExchangeChange={handleExchangeChange}
          onLoadQuote={loadQuote}
          onNext={next}
        />
      )}
      {step === 2 && (
        <Step2Goal
          thesis={thesis}
          onThesisChange={setThesis}
          intention={intention}
          onIntentionChange={setIntention}
          onNext={next}
          onBack={prev}
        />
      )}
      {step === 3 && (
        <Step2Investment
          entryPrice={entryPrice}
          quantity={quantity}
          pollingFrequency={pollingFrequency}
          maxPlanFrequency={maxPlanFrequency}
          intention={intention}
          strategies={strategies}
          selectedStrategy={selectedStrategy}
          onStrategyChange={setSelectedStrategy}
          onEntryPriceChange={setEntryPrice}
          onQuantityChange={setQuantity}
          onPollingFrequencyChange={setPollingFrequency}
          onRunAnalysis={() => void runAnalysis()}
          onBack={prev}
          generating={generating}
          agentMonthlyEstimate={agentMonthlyEstimate}
        />
      )}
      {step === 4 && (
        <Step3Assessment
          analysisRuns={analysisRuns}
          activeAnalysisId={activeAnalysisId}
          onActiveAnalysisChange={setActiveAnalysisId}
          plannedTrade={plannedTrade}
          userFrequency={userFrequencySnapshot}
          entryChoice={entryChoice}
          frequencyChoice={frequencyChoice}
          onEntryChoiceChange={setEntryChoice}
          onFrequencyChoiceChange={setFrequencyChoice}
          onNext={applyAssessmentChoicesAndContinue}
          onBack={prev}
          onTryAnother={() => setStep(3)}
        />
      )}
      {step === 5 && (
        <Step5Configure
          pollingFrequency={pollingFrequency}
          maxPlanFrequency={maxPlanFrequency}
          agentMonthlyEstimate={agentMonthlyEstimate}
          notifyEmail={notifyEmail}
          notifyPush={notifyPush}
          notifySms={notifySms}
          autoSuggestions={autoSuggestions}
          onNotifyEmailChange={setNotifyEmail}
          onNotifyPushChange={setNotifyPush}
          onNotifySmsChange={setNotifySms}
          onAutoSuggestionsChange={setAutoSuggestions}
          onBack={prev}
          onActivate={activateAgent}
          submitting={submitting}
        />
      )}

      <div className="mt-8">
        <Disclaimer />
      </div>
    </AppShell>
  );
}

function Step1Stock({
  ticker,
  exchange,
  quote,
  loadingQuote,
  quoteError,
  onTickerChange,
  onExchangeChange,
  onLoadQuote,
  onNext
}: {
  ticker: string;
  exchange: string;
  quote: { ticker: string; name?: string | null; ltp: number; change_percent: number | null } | null;
  loadingQuote: boolean;
  quoteError: string;
  onTickerChange: (value: string) => void;
  onExchangeChange: (value: string) => void;
  onLoadQuote: () => Promise<{ quote: { ticker: string; name?: string | null; ltp: number; change_percent: number | null } | null; error?: string }>;
  onNext: () => void;
}) {
  const canContinue = Boolean(quote) && !loadingQuote;

  return (
    <div className="mx-auto max-w-3xl">
      <GlassCard>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Search className="h-3.5 w-3.5" /> Step 1 · Find a stock you already trust
        </div>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Stock ticker</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={ticker}
              onChange={(event) => onTickerChange(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void onLoadQuote();
                }
              }}
              className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-10 pr-3 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
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
              onChange={(event) => onExchangeChange(event.target.value)}
              className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="NSE">NSE</option>
              <option value="BSE">BSE</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void onLoadQuote()}
            disabled={loadingQuote || !ticker.trim()}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-50"
          >
            {loadingQuote ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Searching…
              </>
            ) : (
              <>
                <Search className="h-4 w-4" /> Search
              </>
            )}
          </button>
        </div>

        {quoteError && (
          <AlertBanner variant="error" className="mt-4">
            {quoteError}
          </AlertBanner>
        )}

        <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {(quote?.ticker || ticker.toUpperCase() || "—")} · {exchange}
              </div>
              <div className="mt-1 text-base font-semibold tracking-tight">
                {quote ? quote.name || quote.ticker : "No quote yet"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {quote ? "Live price from market data." : "Search to load the live quote before continuing."}
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Mini
              label="Current"
              value={quote ? `₹${quote.ltp.toFixed(2)}` : "—"}
              delta={
                quote?.change_percent !== null && quote?.change_percent !== undefined
                  ? `${quote.change_percent > 0 ? "+" : ""}${quote.change_percent.toFixed(2)}%`
                  : undefined
              }
              up={(quote?.change_percent ?? 0) >= 0}
            />
            <Mini label="Exchange" value={exchange} />
            <Mini label="Ticker" value={ticker.toUpperCase() || "—"} />
            <Mini label="Status" value={quote ? "Ready" : "Search required"} />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onNext}
            disabled={!canContinue}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

function Mini({ label, value, delta, up }: { label: string; value: string; delta?: string; up?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
      {delta && <div className={up ? "text-xs text-emerald-400" : "text-xs text-red-400"}>{delta}</div>}
    </div>
  );
}

function Step2Investment({
  entryPrice,
  quantity,
  pollingFrequency,
  maxPlanFrequency,
  intention,
  strategies,
  selectedStrategy,
  onStrategyChange,
  onEntryPriceChange,
  onQuantityChange,
  onPollingFrequencyChange,
  onRunAnalysis,
  onBack,
  generating,
  agentMonthlyEstimate
}: {
  entryPrice: string;
  quantity: string;
  pollingFrequency: string;
  maxPlanFrequency: number;
  intention: string;
  strategies: StrategyMeta[];
  selectedStrategy: AnalysisStrategyId;
  onStrategyChange: (id: AnalysisStrategyId) => void;
  onEntryPriceChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  onPollingFrequencyChange: (value: string) => void;
  onRunAnalysis: () => void;
  onBack: () => void;
  generating: boolean;
  agentMonthlyEstimate?: number | null;
}) {
  const entry = Number(entryPrice);
  const qty = Number(quantity);
  const freq = clampPollingFrequency(Number(pollingFrequency));
  const total = entry > 0 && qty > 0 ? entry * qty : null;
  const canContinue = entry > 0 && qty > 0 && freq >= 2;
  const exceedsPlan = freq > maxPlanFrequency;

  return (
    <div className="mx-auto max-w-3xl">
      <GlassCard>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Step 3 · Investment details</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Planned investment</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell the AI what you&apos;re planning to buy. This does not place an order. Your goal ({intention.replace(/_/g, " ")}) is included in analysis.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Entry price" prefix="₹" value={entryPrice} onChange={onEntryPriceChange} />
          <Field label="Quantity" value={quantity} onChange={onQuantityChange} />
        </div>

        <div className="mt-4">
          <Field
            label="Checks per trading day"
            hint="2–12"
            tooltip="How many times per market day your agent runs research on this stock."
            value={pollingFrequency}
            onChange={onPollingFrequencyChange}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {freq >= 2 ? describePollingFrequency(freq) : "Enter 2–12 checks per market day."}
          </p>
          {exceedsPlan && (
            <p className="mt-2 text-xs text-amber-800">
              Your plan allows up to {maxPlanFrequency}/day at activation. Higher cadence requires{" "}
              <Link href="/subscription" className="font-medium text-primary underline">
                Pro or Ultra
              </Link>
              .
            </p>
          )}
          {agentMonthlyEstimate != null && agentMonthlyEstimate > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Estimated ~{formatAiUnits(agentMonthlyEstimate)} AI Units/month for this agent.
            </p>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total investment</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">
            {total != null ? `₹${total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {total != null ? `₹${entry.toFixed(2)} × ${qty} shares` : "Enter entry price and quantity to see total."}
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-muted-foreground">
          Run analysis below to get an enter / don&apos;t enter recommendation at your planned price and size.
        </div>

        <div className="mt-6">
          <div className="mb-2 text-sm font-medium text-foreground">Analysis strategy</div>
          <StrategySelector
            strategies={strategies}
            selected={selectedStrategy}
            onSelect={onStrategyChange}
          />
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium hover:bg-white/[0.06]">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button onClick={onRunAnalysis} disabled={generating || !canContinue} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Run Analysis
              </>
            )}
          </button>
        </div>

        {generating && <ResearchProgressSteps active={generating} />}
      </GlassCard>
    </div>
  );
}

const RESEARCH_PROGRESS_STEPS = [
  "Reading latest filings and quarterly results",
  "Computing technical indicators (RSI, MACD, MAs)",
  "Scanning news for material developments",
  "Evaluating sector and macro conditions",
  "Composing assessment with confidence intervals"
] as const;

function ResearchProgressSteps({ active }: { active: boolean }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (!active) {
      setVisibleCount(0);
      return;
    }
    setVisibleCount(1);
    const id = window.setInterval(() => {
      setVisibleCount((prev) => (prev >= RESEARCH_PROGRESS_STEPS.length ? prev : prev + 1));
    }, 750);
    return () => window.clearInterval(id);
  }, [active]);

  if (!active) return null;

  return (
    <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Bot className="h-4 w-4 text-primary" /> Agent is researching <ThinkingDots className="ml-2" />
      </div>
      <div className="mt-4 space-y-2">
        {RESEARCH_PROGRESS_STEPS.map((label, i) => {
          if (i >= visibleCount) return null;
          const isComplete = i < visibleCount - 1 || visibleCount >= RESEARCH_PROGRESS_STEPS.length;
          const isActive = i === visibleCount - 1 && visibleCount < RESEARCH_PROGRESS_STEPS.length;
          return (
            <div
              key={label}
              className={cn(
                "flex items-center gap-2 text-xs transition-opacity duration-300",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {isComplete ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              ) : (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
              )}
              <span>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatInr(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function plannedTotal(entry: string, quantity: string) {
  const e = Number(entry);
  const q = Number(quantity);
  return e > 0 && q > 0 ? e * q : null;
}

function FieldTooltip({ text }: { text: string }) {
  return (
    <span className="group/tooltip relative inline-flex shrink-0">
      <button
        type="button"
        tabIndex={0}
        className="inline-flex rounded-full text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label={text}
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-50 hidden w-64 -translate-x-1/2 rounded-lg border border-border/20 bg-card px-3 py-2.5 text-left text-xs font-normal leading-relaxed text-card-foreground shadow-lg group-hover/tooltip:block group-focus-within/tooltip:block"
      >
        {text}
      </span>
    </span>
  );
}

function Field({
  label,
  value,
  prefix,
  hint,
  tooltip,
  onChange
}: {
  label: string;
  value?: string;
  prefix?: string;
  hint?: string;
  tooltip?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground/80">
          {label}
          {tooltip && <FieldTooltip text={tooltip} />}
        </span>
        {hint && <span className="shrink-0 text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40",
            prefix ? "pl-8" : "pl-3"
          )}
        />
      </div>
    </label>
  );
}

function Step3Assessment({
  analysisRuns,
  activeAnalysisId,
  onActiveAnalysisChange,
  plannedTrade,
  userFrequency,
  entryChoice,
  frequencyChoice,
  onEntryChoiceChange,
  onFrequencyChoiceChange,
  onNext,
  onBack,
  onTryAnother,
}: {
  analysisRuns: StrategyAnalysisResult[];
  activeAnalysisId: AnalysisStrategyId | null;
  onActiveAnalysisChange: (id: AnalysisStrategyId) => void;
  plannedTrade: PlannedTradeSnapshot | null;
  userFrequency: string;
  entryChoice: Choice;
  frequencyChoice: Choice;
  onEntryChoiceChange: (choice: Choice) => void;
  onFrequencyChoiceChange: (choice: Choice) => void;
  onNext: () => void;
  onBack: () => void;
  onTryAnother: () => void;
}) {
  const userEntry = plannedTrade?.entry ?? "";
  const userQty = plannedTrade?.quantity ?? "";
  const userTotal = plannedTotal(userEntry, userQty);
  const userFreq = clampPollingFrequency(Number(userFrequency));
  const activeResult =
    analysisRuns.find((r) => r.strategy === activeAnalysisId) ?? analysisRuns[analysisRuns.length - 1];

  const aiEntry = activeResult?.suggested_entry != null ? String(activeResult.suggested_entry) : "";
  const aiFreq = activeResult?.suggested_polling_frequency ?? 2;
  const aiFreqAdoptable = activeResult
    ? canAdoptFrequency(aiFreq, activeResult.max_adoptable_polling_frequency ?? 2)
    : false;

  const selectedEntry = entryChoice === "ai" && aiEntry ? aiEntry : userEntry;
  const selectedFreq = frequencyChoice === "ai" && aiFreqAdoptable ? aiFreq : userFreq;

  const continueLabel =
    entryChoice === "ai" && frequencyChoice === "ai" && aiFreqAdoptable
      ? "AI entry & cadence"
      : entryChoice === "ai"
        ? "AI entry, my cadence"
        : frequencyChoice === "ai" && aiFreqAdoptable
          ? "my entry, AI cadence"
          : "my choices";

  return (
    <div className="mx-auto max-w-5xl">
      <GlassCard className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Step 4 · AI assessment</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">Review AI suggestions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose entry price and monitoring cadence. Your quantity stays as entered.
            </p>
          </div>
          <Badge variant="primary">Informational</Badge>
        </div>
      </GlassCard>

      <GlassCard className="mb-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Your plan</div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <span className="text-lg font-semibold">
            {userQty && userEntry ? `${userQty} shares @ ${formatInr(Number(userEntry))}` : "—"}
          </span>
          {userTotal != null && (
            <span className="text-sm text-muted-foreground">Total {formatInr(userTotal)}</span>
          )}
        </div>
      </GlassCard>

      {analysisRuns.length > 1 && (
        <div className="mb-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Strategy results
          </div>
          <div className="flex flex-wrap gap-2">
            {analysisRuns.map((run) => (
              <button
                key={run.strategy}
                type="button"
                onClick={() => onActiveAnalysisChange(run.strategy)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium",
                  (activeAnalysisId ?? activeResult?.strategy) === run.strategy
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-white/10 bg-white/[0.02] text-muted-foreground hover:bg-white/[0.04]"
                )}
              >
                {run.strategy.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeResult && <AnalysisResultPanel result={activeResult} className="mb-6" />}

      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Entry price</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <EntryChoiceCard
          title="Your entry"
          subtitle="From step 2"
          selected={entryChoice === "user"}
          onSelect={() => onEntryChoiceChange("user")}
          entry={userEntry}
          actionLabel="Keep my entry"
        />
        <EntryChoiceCard
          title="AI suggested entry"
          subtitle={activeResult ? formatSignal(activeResult.signal ?? undefined) : "No suggestion"}
          selected={entryChoice === "ai"}
          onSelect={() => onEntryChoiceChange("ai")}
          entry={aiEntry}
          actionLabel="Use AI entry"
          disabled={!activeResult?.suggested_entry}
          highlight={activeResult ? getSignalTone(activeResult.signal ?? undefined) : undefined}
        />
      </div>

      <div className="mb-2 mt-6 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Monitoring cadence
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <FrequencyChoiceCard
          title="Your cadence"
          subtitle={describePollingFrequency(userFreq)}
          selected={frequencyChoice === "user"}
          onSelect={() => onFrequencyChoiceChange("user")}
          frequency={userFreq}
          actionLabel="Keep my cadence"
        />
        <FrequencyChoiceCard
          title="AI recommended cadence"
          subtitle={activeResult ? describePollingFrequency(aiFreq) : "No suggestion"}
          selected={frequencyChoice === "ai" && aiFreqAdoptable}
          onSelect={() => aiFreqAdoptable && onFrequencyChoiceChange("ai")}
          frequency={aiFreq}
          actionLabel={aiFreqAdoptable ? "Use AI cadence" : "Pro or Ultra required"}
          disabled={!activeResult?.suggested_polling_frequency || !aiFreqAdoptable}
          locked={!aiFreqAdoptable && !!activeResult?.suggested_polling_frequency}
          rationale={activeResult?.frequency_rationale ?? undefined}
          factors={activeResult?.frequency_factors}
        />
      </div>

      <GlassCard className="mt-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Selected for monitoring</div>
        <div className="mt-2 space-y-1">
          <div className="text-lg font-semibold">
            {userQty && selectedEntry ? `${userQty} shares @ ${formatInr(Number(selectedEntry))}` : "—"}
          </div>
          <div className="text-sm text-muted-foreground">{describePollingFrequency(selectedFreq)}</div>
        </div>
      </GlassCard>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium hover:bg-white/[0.06]">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            onClick={onTryAnother}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium hover:bg-white/[0.06]"
          >
            Try another strategy
          </button>
          <button
            onClick={onNext}
            disabled={!plannedTrade || !activeResult || (entryChoice === "ai" && !aiEntry)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue with {continueLabel} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

const getSignalTone = (sig?: string) => {
  if (!sig) return undefined;
  const s = sig.toLowerCase();
  if (s.includes("buy") || s.includes("support")) return "success";
  if (s.includes("wait") || s.includes("neutral")) return "warning";
  if (s.includes("risk") || s.includes("sell") || s.includes("high")) return "danger";
  return undefined;
};

const formatSignal = (sig?: string) => {
  if (!sig) return "N/A";
  return sig
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

function EntryChoiceCard({
  title,
  subtitle,
  selected,
  onSelect,
  entry,
  actionLabel,
  disabled,
  highlight
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onSelect: () => void;
  entry: string;
  actionLabel: string;
  disabled?: boolean;
  highlight?: "success" | "warning" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "w-full rounded-2xl border p-5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50",
        selected ? "border-primary/50 bg-primary/[0.06] ring-2 ring-primary/25" : "border-white/10 bg-white/[0.02] hover:border-white/20"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div
            className={cn(
              "mt-0.5 text-xs",
              highlight === "success" && "text-emerald-700",
              highlight === "warning" && "text-amber-800",
              highlight === "danger" && "text-red-700",
              !highlight && "text-muted-foreground"
            )}
          >
            {subtitle}
          </div>
        </div>
        {selected && <Badge variant="success">Selected</Badge>}
      </div>
      <div className="mt-4 text-2xl font-semibold">{entry ? formatInr(Number(entry)) : "—"}</div>
      <div className="mt-4 text-xs font-medium text-primary">{actionLabel}</div>
    </button>
  );
}

function FrequencyChoiceCard({
  title,
  subtitle,
  selected,
  onSelect,
  frequency,
  actionLabel,
  disabled,
  locked,
  rationale,
  factors
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onSelect: () => void;
  frequency: number;
  actionLabel: string;
  disabled?: boolean;
  locked?: boolean;
  rationale?: string;
  factors?: string[];
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "w-full rounded-2xl border p-5 text-left transition-all disabled:cursor-not-allowed",
        locked && "opacity-90",
        disabled && !locked && "opacity-50",
        selected ? "border-primary/50 bg-primary/[0.06] ring-2 ring-primary/25" : "border-white/10 bg-white/[0.02] hover:border-white/20"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>
        </div>
        {locked && <Badge variant="primary">Pro</Badge>}
        {selected && !locked && <Badge variant="success">Selected</Badge>}
      </div>
      <div className="mt-4 text-2xl font-semibold">{frequency}/day</div>
      {rationale && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{rationale}</p>
      )}
      {factors && factors.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {factors.map((f) => (
            <span key={f} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-muted-foreground">
              {f}
            </span>
          ))}
        </div>
      )}
      {locked && (
        <p className="mt-3 text-xs text-primary">
          <Link href="/subscription" className="underline" onClick={(e) => e.stopPropagation()}>
            Upgrade to Pro
          </Link>{" "}
          to use {frequency} checks/day.
        </p>
      )}
      <div className="mt-4 text-xs font-medium text-primary">{actionLabel}</div>
    </button>
  );
}

function Stat({
  label,
  value,
  sub,
  tone
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "success" | "danger" | "warning";
}) {
  const isLong = value.length > 15;
  const isVeryLong = value.length > 25;

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 flex flex-col justify-between min-h-[82px] overflow-hidden">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div
          className={cn(
            "mt-1 leading-tight",
            isVeryLong ? "text-xs font-normal" : isLong ? "text-sm font-medium" : "text-lg font-semibold",
            tone === "success" && "text-emerald-400",
            tone === "danger" && "text-red-700",
            tone === "warning" && "text-amber-800"
          )}
        >
          {value}
        </div>
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

const goals = [
  { icon: Sprout, title: "Long Term Wealth", desc: "Compounding over 3+ years", intention: "long_term" },
  { icon: TrendingUp, title: "Swing Trade", desc: "Weeks to a few months", intention: "swing" },
  { icon: Wallet, title: "Retirement", desc: "Steady, lower-risk allocation", intention: "retirement" },
  { icon: Coins, title: "Dividend Income", desc: "Consistent payout focus", intention: "dividend" },
  { icon: Calendar, title: "Short Term", desc: "Tactical, < 6 months", intention: "short_term" },
  { icon: PenLine, title: "Custom Goal", desc: "Define your own thesis", intention: "custom" }
];

function Step2Goal({
  thesis,
  onThesisChange,
  intention,
  onIntentionChange,
  onNext,
  onBack
}: {
  thesis: string;
  onThesisChange: (value: string) => void;
  intention: string;
  onIntentionChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const intentionToIndex = (value: string) => {
    const normalized = value.toLowerCase();
    const idx = goals.findIndex((g) => g.intention === normalized);
    return idx >= 0 ? idx : 0;
  };
  const [picked, setPicked] = useState(() => intentionToIndex(intention));

  useEffect(() => {
    setPicked(intentionToIndex(intention));
  }, [intention]);

  return (
    <div className="mx-auto max-w-3xl">
      <GlassCard>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Step 2 · Investment goal</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Why are you holding this stock?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your intention shapes AI analysis in the next step and how your agent monitors the position.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((g, i) => {
            const Icon = g.icon;
            const active = picked === i;
            return (
              <button
                key={g.title}
                onClick={() => {
                  setPicked(i);
                  onIntentionChange(g.intention);
                }}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-all",
                  active ? "border-primary/60 bg-primary/[0.07]" : "border-white/5 bg-white/[0.02] hover:border-white/15"
                )}
              >
                <div className={cn("grid h-9 w-9 place-items-center rounded-lg", active ? "bg-primary text-primary-foreground" : "bg-white/[0.05] text-muted-foreground")}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="mt-3 text-sm font-medium">{g.title}</div>
                <div className="text-xs text-muted-foreground">{g.desc}</div>
              </button>
            );
          })}
        </div>

        <label className="mt-6 block">
          <span className="mb-1.5 block text-xs font-medium text-foreground/80">What is your investment thesis?</span>
          <textarea
            rows={4}
            value={thesis}
            onChange={(event) => onThesisChange(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <p className="mt-2 text-xs text-muted-foreground">
          Current intention: <span className="font-medium text-foreground">{intention}</span>
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium hover:bg-white/[0.06]">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button onClick={onNext} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110">
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

function Step5Configure({
  pollingFrequency,
  maxPlanFrequency,
  notifyEmail,
  notifyPush,
  notifySms,
  autoSuggestions,
  onNotifyEmailChange,
  onNotifyPushChange,
  onNotifySmsChange,
  onAutoSuggestionsChange,
  onBack,
  onActivate,
  submitting,
  agentMonthlyEstimate
}: {
  pollingFrequency: string;
  maxPlanFrequency: number;
  notifyEmail: boolean;
  notifyPush: boolean;
  notifySms: boolean;
  autoSuggestions: boolean;
  onNotifyEmailChange: (value: boolean) => void;
  onNotifyPushChange: (value: boolean) => void;
  onNotifySmsChange: (value: boolean) => void;
  onAutoSuggestionsChange: (value: boolean) => void;
  onBack: () => void;
  onActivate: () => Promise<void>;
  submitting: boolean;
  agentMonthlyEstimate?: number | null;
}) {
  const freq = clampPollingFrequency(Number(pollingFrequency));
  const cappedAtActivation = freq > maxPlanFrequency;

  return (
    <div className="mx-auto max-w-3xl">
      <GlassCard>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Step 5 · Agent configuration</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Assign your AI monitoring agent</h2>

        <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Monitoring cadence
          </div>
          <div className="mt-2 text-lg font-semibold">{freq}/day</div>
          <p className="mt-1 text-xs text-muted-foreground">{describePollingFrequency(freq)}</p>
          {agentMonthlyEstimate != null && agentMonthlyEstimate > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Estimated ~{formatAiUnits(agentMonthlyEstimate)} AI Units/month for this agent.
            </p>
          )}
          {cappedAtActivation && (
            <p className="mt-2 text-xs text-amber-800">
              Your plan activates agents at {maxPlanFrequency}/day maximum.{" "}
              <Link href="/subscription" className="font-medium text-primary underline">
                Upgrade to Pro
              </Link>{" "}
              for higher cadence.
            </p>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <div>
            <div className="text-sm font-medium">Automatic action suggestions</div>
            <div className="text-xs text-muted-foreground">Agent surfaces suggested actions. You still decide and execute.</div>
          </div>
          <Switch on={autoSuggestions} onChange={onAutoSuggestionsChange} />
        </div>

        <div className="mt-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            <Bell className="mr-1 inline h-3.5 w-3.5" /> Notifications
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-1">
            <Toggle icon={Mail} label="Email alerts" on={notifyEmail} onChange={onNotifyEmailChange} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Push and SMS coming soon. In-app notifications always appear in your feed.</p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium hover:bg-white/[0.06]">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button
            onClick={onActivate}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-70"
          >
            <Bot className="h-4 w-4" /> {submitting ? "Activating..." : "Activate Agent"}
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

function Toggle({
  icon: Icon,
  label,
  on,
  onChange
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  on: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button onClick={() => onChange(!on)} className={cn("flex items-center justify-between rounded-xl border p-3 text-sm", on ? "border-primary/40 bg-primary/[0.06]" : "border-white/5 bg-white/[0.02]")}>
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" /> {label}
      </span>
      <Switch on={on} />
    </button>
  );
}

function Switch({ on, onChange }: { on: boolean; onChange?: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange?.(!on)}
      className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors", on ? "bg-primary" : "bg-white/10")}
    >
      <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", on ? "translate-x-4" : "translate-x-0.5")} />
    </button>
  );
}

