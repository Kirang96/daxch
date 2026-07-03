export const GUIDE_OVERVIEW =
  "Daxch helps you trade with more context, not more noise. Before you buy, use Research to run AI analysis on a stock — fundamentals, technicals, news, and sentiment — so you can decide with evidence instead of guesswork. Once you own a position, monitoring agents watch the stock and what moves around it on a schedule you choose: earnings, headlines, price action, and macro shifts. Buying is only one part of the story; the harder work is knowing when to hold, add, or exit. Daxch surfaces that ongoing picture and suggests next steps — you stay in control and approve every trade.";

export const GUIDE_SECTIONS = [
  {
    id: "agents",
    title: "Agents & entry orders",
    body: "An agent monitors one stock you chose. You set a planned limit price and quantity — that plan feeds the AI and is not synced from your Demat. When you create an agent, Daxch places a LIMIT buy at your chosen price. Monitoring and AI unit usage begin only after your order fills on the exchange. If placement fails, use Retry entry on the agent page; while awaiting fill, the agent stays paused.",
    lifecycle: "Create → LIMIT order → Awaiting fill → Active monitoring → AI suggestion → You approve → Filled on exchange",
  },
  {
    id: "ai-approvals",
    title: "AI suggestions & your plan",
    body: "Your entry price and quantity on the agent page are inputs to the AI thesis. Exchange trades below are real orders sent to your broker after you approve a suggestion. P/L and positions appear only after orders fill. On schedule, the agent researches the stock and may suggest buy more, sell, or hold — nothing is sent until you approve. Use Square off to exit part or all at market without waiting for AI.",
  },
  {
    id: "broker-units",
    title: "Broker connection & AI Units",
    body: "Daxch connects to your broker via OAuth with read and trade scopes you approve. We never store your broker password; revoke access anytime from your broker or by disconnecting in Daxch. Each analysis run and monitoring check consumes AI Units from your monthly plan. Starter uses GPT-4o Mini only; Pro and Ultra can choose other models in Settings.",
  },
] as const;

export const GUIDE_FAQ = [
  {
    q: "Does Daxch trade automatically?",
    a: "No. AI suggests buy, sell, or hold — you approve every trade before it is sent to your broker. The only exception is the LIMIT entry order you explicitly set when creating an agent.",
  },
  {
    q: "What happens if my entry order doesn't fill?",
    a: "The agent stays paused until your limit order fills on the exchange. You can cancel the order from the agent page. Outside market hours, orders may be placed as AMO (After Market Order).",
  },
  {
    q: "Can I exit without waiting for AI?",
    a: "Yes. Use Square off on the agent page to sell part or all of your exchange position at market.",
  },
  {
    q: "What's the difference between Research and an agent?",
    a: "Research is ad-hoc analysis without creating a monitoring agent. An agent runs scheduled checks and can place trades after your approval.",
  },
  {
    q: "When am I charged AI Units?",
    a: "Each analysis run and each scheduled monitoring check consumes AI Units based on your plan allowance and chosen model.",
  },
  {
    q: "Is this investment advice?",
    a: "No. Daxch provides AI-generated analysis for informational purposes only. You are responsible for your investment decisions.",
  },
] as const;

export const GUIDE_JOURNEY = [
  { step: "1", title: "Connect broker", desc: "Link your broker so orders and positions sync.", href: "/broker" },
  { step: "2", title: "Create an agent", desc: "Pick a stock, set your goal and limit price.", href: "/agents/new" },
  { step: "3", title: "Entry fills", desc: "Your LIMIT order goes to the exchange; monitoring starts after fill.", href: "/agents" },
  {
    step: "4",
    title: "Monitor & decide",
    desc: "Scheduled AI research produces suggestions — you approve before anything is sent to your broker.",
    href: "/agents",
  },
] as const;

export const GUIDE_FEATURES = [
  { title: "Dashboard", desc: "Overview, setup checklist, and AI usage.", href: "/dashboard" },
  { title: "Agents", desc: "Create and manage monitoring agents.", href: "/agents" },
  { title: "Research", desc: "Run analysis without creating an agent.", href: "/research" },
  { title: "Portfolio", desc: "Exchange positions and P/L.", href: "/portfolio" },
  { title: "Watchlist", desc: "Track symbols before committing.", href: "/watchlist" },
  { title: "Subscription", desc: "Plans, AI Units, and billing.", href: "/subscription" },
] as const;
