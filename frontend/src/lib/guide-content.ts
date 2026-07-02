export const GUIDE_SECTIONS = [
  {
    id: "agents",
    title: "What is an agent?",
    body: "An agent is a monitoring job for one stock you chose. You set a planned limit price and quantity — that plan feeds the AI. It is not synced from your Demat. Monitoring and AI unit usage begin only after your LIMIT entry order fills on the exchange.",
  },
  {
    id: "plan-vs-demat",
    title: "Your plan vs exchange position",
    body: "The entry price and quantity on the agent page are your inputs to the AI thesis. Exchange trades below are real orders sent to Upstox after you approve a suggestion. P/L and positions appear only after orders fill on the exchange.",
  },
  {
    id: "entry-orders",
    title: "Entry orders",
    body: "When you create an agent, Daxch places a LIMIT buy at your chosen price. Outside market hours, orders may be sent as AMO (After Market Order). If placement fails, use Retry entry on the agent page. While awaiting fill, the agent stays paused.",
  },
  {
    id: "suggestions",
    title: "AI suggestions and approvals",
    body: "On schedule, the agent researches the stock and may suggest buy more, sell, or hold. Nothing is sent to your broker until you approve. Use Square off to exit part or all of a position at market without waiting for AI.",
  },
  {
    id: "ai-units",
    title: "AI Units",
    body: "Each analysis run and each monitoring check consumes AI Units from your monthly plan. Heavier models use more units per run. Starter uses GPT-4o Mini only; Pro and Ultra can choose other models in Settings.",
  },
  {
    id: "broker",
    title: "Broker connection",
    body: "Daxch connects to Upstox via OAuth with read and trade scopes you approve. We never store your Upstox password. You can revoke access anytime from Upstox or by disconnecting in Daxch.",
  },
] as const;

export const GUIDE_FAQ = [
  {
    q: "Does Daxch trade automatically?",
    a: "No. AI suggests buy, sell, or hold — you approve every trade before it is sent to Upstox. The only exception is the LIMIT entry order you explicitly set when creating an agent.",
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
  { step: "1", title: "Connect broker", desc: "Link Upstox so orders and positions sync.", href: "/broker" },
  { step: "2", title: "Create an agent", desc: "Pick a stock, set your goal and limit price.", href: "/agents/new" },
  { step: "3", title: "Entry fills", desc: "Your LIMIT order goes to the exchange; monitoring starts after fill.", href: "/agents" },
  { step: "4", title: "AI monitors", desc: "Scheduled research produces buy, sell, or hold suggestions.", href: "/agents" },
  { step: "5", title: "You decide", desc: "Approve or reject; Daxch sends orders to Upstox.", href: "/agents" },
] as const;

export const GUIDE_FEATURES = [
  { title: "Dashboard", desc: "Overview, setup checklist, and AI usage.", href: "/dashboard" },
  { title: "Agents", desc: "Create and manage monitoring agents.", href: "/agents" },
  { title: "Research", desc: "Run analysis without creating an agent.", href: "/research" },
  { title: "Portfolio", desc: "Exchange positions and P/L.", href: "/portfolio" },
  { title: "Watchlist", desc: "Track symbols before committing.", href: "/watchlist" },
  { title: "Subscription", desc: "Plans, AI Units, and billing.", href: "/subscription" },
] as const;
