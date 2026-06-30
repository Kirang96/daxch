import Link from "next/link";
import {
  ArrowRight,
  FlaskConical,
  Bell,
  Github,
  Linkedin
} from "lucide-react";

import { AmbientBackground } from "@/components/landing/ambient-background";
import { CtaBanner } from "@/components/landing/cta-banner";
import { FaqSection } from "@/components/landing/faq-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSteps } from "@/components/landing/how-it-works-steps";
import { PricingSection } from "@/components/landing/pricing-section";

export default function HomePage() {
  const features = [
    {
      icon: "Bot" as const,
      title: "AI Monitoring Agents",
      desc: "Dedicated agents per position with thesis-aware monitoring cadence."
    },
    {
      icon: "Activity" as const,
      title: "Continuous Research",
      desc: "Fundamentals, technicals, macro and news — analyzed on schedule."
    },
    {
      icon: "Plug" as const,
      title: "Broker Integration",
      desc: "Secure Upstox integration now. More brokers coming soon."
    },
    {
      icon: "PieChart" as const,
      title: "Portfolio Monitoring",
      desc: "Exchange P/L from filled orders, risk exposure and per-position AI health in one view."
    },
    {
      icon: "ShieldAlert" as const,
      title: "Risk Alerts",
      desc: "Volatility and risk-break alerts surfaced before they become losses."
    },
    {
      icon: "Newspaper" as const,
      title: "News Analysis",
      desc: "Material announcements linked directly to your active thesis."
    }
  ];

  const plans = [
    {
      id: "starter",
      name: "Starter",
      price: "₹499",
      desc: "For investors stepping into AI-assisted monitoring.",
      features: ["3,000 AI Units/month", "10 AI Agents", "Standard monitoring", "Buy extra units anytime"],
      cta: "Get started",
      highlighted: false
    },
    {
      id: "pro",
      name: "Professional",
      price: "₹999",
      desc: "For serious portfolios that deserve closer watching.",
      features: [
        "12,000 AI Units/month",
        "Unlimited agents",
        "Custom frequency",
        "All analysis strategies",
        "Buy extra units anytime"
      ],
      cta: "Get started",
      highlighted: true
    },
    {
      id: "ultra",
      name: "Ultra",
      price: "₹2,499",
      desc: "Maximum AI capacity for power users.",
      features: [
        "35,000 AI Units/month",
        "Unlimited agents",
        "Priority AI processing",
        "Buy extra units anytime"
      ],
      cta: "Get started",
      highlighted: false
    }
  ];

  const howItWorks = [
    { step: "1", title: "Pick your stock", desc: "Set your planned entry and investment goal." },
    { step: "2", title: "AI monitors", desc: "Agents research fundamentals, technicals, and news on schedule." },
    { step: "3", title: "Review suggestions", desc: "Read evidence-backed conclusions with risk context." },
    { step: "4", title: "Approve trades", desc: "Only orders you confirm are sent to Upstox." }
  ];

  const faq = [
    {
      q: "Does Daxch recommend stocks to buy?",
      a: "No. Daxch is not a stock recommendation platform. You bring the stock and the AI helps with monitoring."
    },
    {
      q: "How does monitoring work?",
      a: "Each position gets an AI agent that analyzes fundamentals, technicals and market context on your schedule."
    },
    {
      q: "Which brokers are supported?",
      a: "Upstox is supported today. Zerodha, Angel One, Groww and Shoonya are on roadmap."
    }
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[900px]" style={{ background: "var(--gradient-hero)" }} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 grid-bg opacity-[0.35] [mask-image:radial-gradient(60%_50%_at_50%_0%,#000,transparent)]"
      />
      <AmbientBackground />

      <header className="sticky top-0 z-30 border-b border-border/12 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/40 text-primary-foreground">
              <FlaskConical className="h-4 w-4" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">Daxch</span>
          </div>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="#pricing" className="hover:text-foreground">
              Pricing
            </a>
            <a href="#faq" className="hover:text-foreground">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground sm:inline-flex">
              Sign in
            </Link>
            <Link
              href="/signup?plan=starter"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
            >
              Get started <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <HeroSection />
      <HowItWorksSteps steps={howItWorks} />
      <FeaturesSection features={features} />
      <PricingSection plans={plans} />
      <FaqSection items={faq} />
      <CtaBanner />

      <footer className="relative border-t border-border/12">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-4">
          <div className="md:col-span-2">
            <p className="text-[15px] font-semibold tracking-tight">Daxch</p>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              Daxch is an AI-powered stock monitoring assistant. You choose what to invest in. We help you watch it.
            </p>
            <div className="mt-5 flex gap-2">
              {[Bell, Github, Linkedin].map((Icon, i) => (
                <a key={i} href="#" className="grid h-9 w-9 place-items-center rounded-lg border border-border/15 bg-muted text-muted-foreground transition-colors hover:text-foreground">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
          {[
            {
              title: "Product",
              links: [
                { label: "Features", href: "#features" },
                { label: "Pricing", href: "#pricing" },
                { label: "Demo", href: "/demo" },
                { label: "FAQ", href: "#faq" }
              ]
            },
            {
              title: "Company",
              links: [
                { label: "Trust", href: "/trust" },
                { label: "Terms", href: "/terms" },
                { label: "Privacy", href: "/privacy" },
                { label: "Sign up", href: "/signup" }
              ]
            }
          ].map((col) => (
            <div key={col.title}>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{col.title}</div>
              <ul className="mt-4 space-y-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-foreground/80 hover:text-foreground">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border/12">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-6 py-6 text-xs text-muted-foreground md:flex-row md:items-center">
            <span>© {new Date().getFullYear()} Daxch Technologies. All rights reserved.</span>
            <span>Daxch is not a SEBI-registered investment advisor. Informational only.</span>
          </div>
        </div>
      </footer>
      <div className="mx-auto max-w-7xl px-6 pb-6 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground/70">Disclaimer · </span>
        This platform provides AI-generated analysis for informational purposes only and does not provide investment
        advice. You are solely responsible for all investment and trading decisions.
      </div>
    </div>
  );
}
