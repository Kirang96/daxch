export type StockHolding = {
  id: string;
  ticker: string;
  exchange: string;
  entry_price: number;
  quantity: number;
  intention: string;
  status: string;
  sector?: string | null;
};

export type MonitorAgent = {
  id: string;
  holding_id: string;
  polling_frequency: number;
  status: string;
  next_poll_at: string | null;
};

export type OrderSnapshot = {
  id: string;
  broker_order_id: string | null;
  order_type: string;
  status: string;
  price: number;
  quantity: number;
  filled_quantity?: number;
  average_price?: number | null;
  transaction_type?: string | null;
  broker_status?: string | null;
  filled_at?: string | null;
  created_at: string;
};

export type BrokerOrderStatus = {
  order_id: string;
  broker_order_id: string;
  internal_status: string;
  broker_status: string;
  filled_quantity: number;
  pending_quantity: number;
  average_price: number | null;
  exchange_order_id: string | null;
  transaction_type: string | null;
  ticker: string | null;
  message: string | null;
};

export type AgentDecision = {
  id: string;
  agent_id: string;
  decision_type: string;
  reasoning: string;
  analysis_data: Record<string, unknown>;
  confirmation_status: string;
  decided_at: string;
  confirmed_at: string | null;
  order: OrderSnapshot | null;
};

export type AgentDetail = {
  agent: MonitorAgent;
  holding: StockHolding;
  decisions: AgentDecision[];
  recent_audit: Array<{
    event_type: string;
    payload: Record<string, unknown>;
    created_at: string;
  }>;
};

export type Subscription = {
  id: string;
  plan: string;
  status: string;
  current_period_end: string | null;
  trial_ends_at?: string | null;
  days_left?: number | null;
  is_trial?: boolean;
  checkout_url?: string | null;
  provider_subscription_id?: string | null;
};

export type PlanInfo = {
  price: number;
  agent_limit: number | null;
  monthly_ai_units: number;
  name: string;
};

export type AiUnitsQuota = {
  plan_allowance: number;
  plan_remaining: number;
  plan_consumed: number;
  bonus_balance: number;
  total_remaining: number;
  total_used: number;
  total_limit: number;
  percent_used: number;
  period_start: string;
  period_end: string;
  has_active_subscription: boolean;
};

export type AiUnitsEstimate = {
  estimated_monthly_units: number;
  total_daily_polls: number | null;
  model: string;
};

export type TopupPack = {
  id: string;
  units: number;
  price_inr: number;
  label: string;
};

export type TopupPurchase = {
  id: string;
  pack_id: string;
  units_granted: number;
  amount_inr: number;
  status: string;
  created_at: string;
  paid_at: string | null;
};

export type Invoice = {
  id: string;
  invoice_id: string;
  amount: number;
  currency: string;
  status: string;
  invoice_date: string;
  period_start: string | null;
  period_end: string | null;
  download_url: string | null;
};

export type WatchlistItem = {
  id: string;
  ticker: string;
  exchange: string;
  note: string | null;
  target_price: number | null;
  created_at: string;
  updated_at: string;
};

export type NotificationEvent = {
  id: string;
  event_type: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export type AiModelOption = {
  id: string;
  label: string;
  description: string;
};

export type UserSettings = {
  id: string;
  profile_name: string | null;
  timezone: string | null;
  preferred_currency: string | null;
  notification_preferences: Record<string, unknown>;
  security_preferences: Record<string, unknown>;
  api_connections: Record<string, unknown>;
  preferred_ai_model: string;
  ai_model_can_change: boolean;
  ai_model_options: AiModelOption[];
  created_at: string;
  updated_at: string;
};

export type ResearchSnapshot = {
  ticker: string;
  exchange: string;
  ltp: number;
  change_percent: number | null;
  analysis: StrategyAnalysisResult;
  recent_decisions: Array<{
    decision_type: string;
    confirmation_status: string;
    reasoning: string;
    decided_at: string;
  }>;
};

export type ExchangePosition = {
  holding_id: string;
  ticker: string;
  exchange: string;
  net_quantity: number;
  average_cost: number;
  invested: number;
  market_value: number | null;
  unrealized_pnl: number | null;
  unrealized_pnl_pct: number | null;
  has_exchange_position: boolean;
};

export type PortfolioSummary = {
  has_exchange_positions: boolean;
  invested: number;
  market_value: number | null;
  unrealized_pnl: number | null;
  unrealized_pnl_pct: number | null;
  position_count: number;
};

export type ExchangePositionsResponse = {
  positions: ExchangePosition[];
  summary: PortfolioSummary;
};

export type AnalysisStrategyId = "technical_trend" | "news_sentiment" | "ai_trade_setup";

export type StrategyAnalysisResult = {
  strategy: AnalysisStrategyId;
  ticker: string;
  decision_type: "enter" | "dont_enter";
  confidence: number;
  reasoning: string;
  quantity_delta: number;
  risk_flags: string[];
  disclaimer: string;
  metadata?: Record<string, unknown>;
  suggested_entry?: number | null;
  signal?: string | null;
  suggested_polling_frequency?: number | null;
  frequency_rationale?: string | null;
  frequency_factors?: string[];
  max_adoptable_polling_frequency?: number;
};

export type StrategyMeta = {
  id: AnalysisStrategyId;
  name: string;
  description: string;
  min_plan: "starter" | "pro";
  available: boolean;
};

export type StrategyListResponse = {
  plan: string;
  strategies: StrategyMeta[];
};

export type AnalysisApiResponse = {
  ticker: string;
  exchange: string;
  analysis: StrategyAnalysisResult;
};
