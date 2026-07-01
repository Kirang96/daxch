export type PlanId = "starter" | "pro" | "ultra";

export const PLAN_ORDER: readonly PlanId[] = ["starter", "pro", "ultra"];

export type PlanDisplayMeta = {
  id: PlanId;
  name: string;
  priceInr: number;
  desc: string;
  highlighted: boolean;
  cta: string;
  features: string[];
};

const SHARED_PLATFORM: readonly string[] = [
  "Portfolio, watchlist & research center",
  "Upstox connection — you approve every trade",
  "In-app alerts & email notifications",
  "Buy extra AI Units anytime (from ₹249)"
];

const PLAN_FEATURES: Record<PlanId, readonly string[]> = {
  starter: [
    "3,000 AI Units per month",
    "Up to 10 monitoring agents",
    "2 checks per trading day per agent",
    "Technical Trend & News & Sentiment strategies",
    "GPT-4o Mini for all AI tasks",
    ...SHARED_PLATFORM
  ],
  pro: [
    "12,000 AI Units per month",
    "Unlimited monitoring agents",
    "Up to 12 checks per trading day (~every 30 min)",
    "All 3 strategies, including AI Trade Setup",
    "Choose AI model (GPT-4o Mini through GPT-4.1)",
    ...SHARED_PLATFORM
  ],
  ultra: [
    "35,000 AI Units per month (~3× Pro capacity)",
    "Unlimited monitoring agents",
    "Up to 12 checks per trading day (~every 30 min)",
    "All 3 strategies, including AI Trade Setup",
    "Choose AI model (GPT-4o Mini through GPT-4.1)",
    "Ideal for many agents or high-frequency monitoring",
    ...SHARED_PLATFORM
  ]
};

const PLAN_META: Record<PlanId, Omit<PlanDisplayMeta, "features">> = {
  starter: {
    id: "starter",
    name: "Starter",
    priceInr: 499,
    desc: "Try AI monitoring on a focused portfolio.",
    highlighted: false,
    cta: "Get started"
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceInr: 999,
    desc: "Serious portfolios with tighter monitoring and deeper AI.",
    highlighted: true,
    cta: "Get started"
  },
  ultra: {
    id: "ultra",
    name: "Ultra",
    priceInr: 2499,
    desc: "Maximum AI capacity for power users and larger portfolios.",
    highlighted: false,
    cta: "Get started"
  }
};

export type PlanComparisonRow = {
  label: string;
  starter: string;
  pro: string;
  ultra: string;
};

export const PLAN_COMPARISON_ROWS: readonly PlanComparisonRow[] = [
  {
    label: "AI Units / month",
    starter: "3,000",
    pro: "12,000",
    ultra: "35,000"
  },
  {
    label: "Monitoring agents",
    starter: "Up to 10",
    pro: "Unlimited",
    ultra: "Unlimited"
  },
  {
    label: "Checks per trading day",
    starter: "2 (open & close)",
    pro: "Up to 12",
    ultra: "Up to 12"
  },
  {
    label: "Analysis strategies",
    starter: "2",
    pro: "All 3",
    ultra: "All 3"
  },
  {
    label: "AI model choice",
    starter: "GPT-4o Mini",
    pro: "GPT-4o Mini → GPT-4.1",
    ultra: "GPT-4o Mini → GPT-4.1"
  },
  {
    label: "Research & watchlist",
    starter: "Included",
    pro: "Included",
    ultra: "Included"
  },
  {
    label: "Upstox + approve trades",
    starter: "Included",
    pro: "Included",
    ultra: "Included"
  },
  {
    label: "AI Unit top-ups",
    starter: "From ₹249",
    pro: "From ₹249",
    ultra: "From ₹249"
  }
];

export function isPlanId(value: string): value is PlanId {
  return value === "starter" || value === "pro" || value === "ultra";
}

export function getPlanFeatures(planId: string): string[] {
  if (!isPlanId(planId)) return [...PLAN_FEATURES.starter];
  return [...PLAN_FEATURES[planId]];
}

export function getPlanMeta(planId: PlanId): PlanDisplayMeta {
  return {
    ...PLAN_META[planId],
    features: getPlanFeatures(planId)
  };
}

export function getPlanDescription(planId: string): string {
  if (!isPlanId(planId)) return PLAN_META.starter.desc;
  return PLAN_META[planId].desc;
}

export function isPlanHighlighted(planId: string): boolean {
  if (!isPlanId(planId)) return false;
  return PLAN_META[planId].highlighted;
}

export function formatPlanPrice(priceInr: number): string {
  return `₹${priceInr.toLocaleString("en-IN")}`;
}

export type LandingPlan = {
  id: string;
  name: string;
  price: string;
  desc: string;
  features: string[];
  cta: string;
  highlighted: boolean;
};

export function getLandingPlans(): LandingPlan[] {
  return PLAN_ORDER.map((id) => {
    const meta = PLAN_META[id];
    return {
      id: meta.id,
      name: id === "pro" ? "Professional" : meta.name,
      price: formatPlanPrice(meta.priceInr),
      desc: meta.desc,
      features: getPlanFeatures(id),
      cta: meta.cta,
      highlighted: meta.highlighted
    };
  });
}

export function buildPlanCardFromApi(
  id: string,
  apiInfo: { name: string; price: number; agent_limit?: number | null }
): {
  id: string;
  name: string;
  price: string;
  desc: string;
  features: string[];
  highlighted: boolean;
  agentLimit: number | null | undefined;
} {
  return {
    id,
    name: apiInfo.name,
    price: formatPlanPrice(apiInfo.price),
    desc: getPlanDescription(id),
    features: getPlanFeatures(id),
    highlighted: isPlanHighlighted(id),
    agentLimit: apiInfo.agent_limit
  };
}
