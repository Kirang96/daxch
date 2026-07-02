import Link from "next/link";

import { PricingComparisonTable } from "@/components/landing/pricing-comparison-table";
import { getLandingPlans } from "@/lib/plan-features";

type Plan = ReturnType<typeof getLandingPlans>[number];

const FEATURES = [
  {
    title: "Sentiment Synthesis",
    desc: "Agents parse every headline, filing and transcript to isolate the real consensus — not the noise."
  },
  {
    title: "Technical Vigilance",
    desc: "Continuous monitoring of price levels, breakouts and institutional volume patterns against your thesis."
  },
  {
    title: "Risk Surfacing",
    desc: "Regulatory changes, management shifts and volatility spikes — surfaced before they hit the tape."
  },
  {
    title: "Earnings Audit",
    desc: "Instant summaries of earnings calls with the specific deviations from analyst expectations flagged."
  },
  {
    title: "Broker Integration",
    desc: "Native Upstox support today. Zerodha, Angel One, Groww and Shoonya are on the public roadmap."
  },
  {
    title: "Evidence Citations",
    desc: "Every conclusion links back to the raw source — filings, transcripts, chart windows. You verify."
  }
];

const WORKFLOW = [
  {
    n: "01",
    title: "Connect Portfolio",
    desc: "Securely sync your Upstox holdings via OAuth. We read positions — never place trades, never store credentials."
  },
  {
    n: "02",
    title: "Define Watchlist",
    desc: "Select the specific stocks you want monitored. Set your thesis: entry, target, stop-loss. Daxch focuses only on your stakes."
  },
  {
    n: "03",
    title: "Receive Evidence",
    desc: "Context-rich updates on technicals, news and earnings, each backed by a citation to the raw source you can verify."
  }
];

const FAQ = [
  {
    q: "Does Daxch recommend stocks to buy?",
    a: "No. Daxch is not a stock recommendation platform. You bring the stock — our AI agents research it, continuously monitor it and provide decision-support. Every action stays with you."
  },
  {
    q: "How does monitoring work?",
    a: "Each position is assigned a dedicated AI agent. It analyzes fundamentals, technicals, news and macro conditions on your chosen cadence, then summarizes findings against your thesis."
  },
  {
    q: "Which brokers are supported?",
    a: "Upstox is supported today. Zerodha, Angel One, Groww and Shoonya are on the public roadmap."
  },
  {
    q: "Is my data secure?",
    a: "Daxch uses OAuth with read-scoped broker tokens. We never store credentials and you can revoke access at any time."
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Plans are monthly and you can cancel from your Subscription settings — your agents pause cleanly."
  }
];

function PricingCard({ plan }: { plan: Plan }) {
  const featured = plan.highlighted;

  return (
    <div
      className={
        featured
          ? "relative flex flex-col border border-primary bg-primary p-8 text-primary-foreground shadow-xl md:p-10"
          : "flex flex-col border border-border/15 bg-background p-8 md:p-10"
      }
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className={`text-xl font-bold ${featured ? "text-primary-foreground" : "text-foreground"}`}>{plan.name}</h3>
        {featured && (
          <span className="editorial-label text-primary-foreground/60">Most active</span>
        )}
      </div>
      <div className="mb-6">
        <span className="font-mono text-3xl">{plan.price}</span>
        <span className={featured ? "text-sm uppercase opacity-60" : "text-sm uppercase text-muted-foreground"}>
          {" "}
          / month
        </span>
      </div>
      <p className={featured ? "mb-8 text-sm opacity-70" : "mb-8 text-sm text-muted-foreground"}>{plan.desc}</p>
      <ul className="mb-10 flex-grow space-y-3 text-sm">
        {plan.features.slice(0, 6).map((f) => (
          <li key={f} className="flex items-start gap-3">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${featured ? "bg-primary-foreground" : "bg-primary"}`} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href={`/signup?plan=${plan.id}`}
        className={
          featured
            ? "bg-primary-foreground py-4 text-center text-xs font-bold uppercase tracking-[0.24em] text-primary transition-colors hover:bg-white"
            : "border border-border py-4 text-center text-xs font-bold uppercase tracking-[0.24em] transition-colors hover:bg-muted"
        }
      >
        {plan.cta}
      </Link>
    </div>
  );
}

export default function HomePage() {
  const plans = getLandingPlans();

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
      {/* Nav */}
      <nav className="border-b border-border/20 px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="font-serif text-2xl font-bold tracking-tight text-[oklch(0.15_0_0)]">
            Daxch
          </Link>
          <div className="hidden items-center gap-8 text-xs font-medium uppercase tracking-[0.18em] md:flex">
            <a href="#platform" className="hover:opacity-70">
              Platform
            </a>
            <a href="#workflow" className="hover:opacity-70">
              Workflow
            </a>
            <a href="#pricing" className="hover:opacity-70">
              Pricing
            </a>
            <a href="#faq" className="hover:opacity-70">
              FAQ
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-xs font-medium uppercase tracking-[0.18em] hover:opacity-70 sm:inline-flex">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="bg-[oklch(0.15_0_0)] px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-primary"
            >
              Enter App
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="border-b border-border/20 px-6 py-20 md:py-28">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 lg:grid-cols-10">
          <div className="lg:col-span-6">
            <div className="editorial-label mb-8 flex items-center gap-3 text-muted-foreground">
              <span className="h-px w-8 bg-primary" />
              Vol. I · Issue 001 · Est. 2026
            </div>
            <h1 className="mb-8 font-serif text-5xl leading-[1.05] text-[oklch(0.15_0_0)] md:text-6xl lg:text-7xl">
              Your portfolio deserves a <span className="italic">dedicated research desk</span>.
            </h1>
            <p className="mb-10 max-w-xl text-lg leading-relaxed md:text-xl">
              Not a recommender. A watcher. Daxch deploys AI agents to monitor the stocks you already own — surfacing
              evidence-backed updates on news, technicals and earnings, only when they matter.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/signup"
                className="bg-primary px-8 py-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[oklch(0.15_0_0)]"
              >
                Start Monitoring
              </Link>
              <a
                href="#workflow"
                className="border border-foreground px-8 py-4 text-sm font-semibold text-[oklch(0.15_0_0)] transition-colors hover:bg-muted"
              >
                View Methodology
              </a>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              Daxch does not recommend stocks. You bring the ticker — the agents do the watching.
            </p>
          </div>

          {/* Agent Proof Card */}
          <div className="lg:col-span-4">
            <div className="border border-border/15 bg-muted p-6 shadow-editorial">
              <div className="mb-6 flex items-start justify-between border-b border-border/15 pb-4">
                <div>
                  <div className="editorial-label mb-1 flex items-center gap-1.5 text-primary">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                    Agent Active
                  </div>
                  <h3 className="font-mono text-xl font-medium">HDFCBANK.NSE</h3>
                </div>
                <div className="text-right">
                  <div className="font-mono text-lg">₹1,642.40</div>
                  <div className="font-mono text-xs text-emerald-800">+1.24%</div>
                </div>
              </div>
              <svg viewBox="0 0 200 40" className="mb-5 h-10 w-full" preserveAspectRatio="none">
                <path
                  d="M0 30 L15 28 L30 32 L45 24 L60 26 L75 20 L90 22 L105 16 L120 18 L135 12 L150 14 L165 8 L180 10 L200 4"
                  fill="none"
                  stroke="oklch(var(--primary))"
                  strokeWidth="1.5"
                />
              </svg>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-0.5 shrink-0 self-stretch bg-primary" />
                  <div className="text-sm">
                    <p className="editorial-label mb-1 text-muted-foreground">Technical Signal</p>
                    <p className="leading-snug">Price consolidated above 200-DMA with rising volume profile.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-0.5 shrink-0 self-stretch bg-primary/40" />
                  <div className="text-sm">
                    <p className="editorial-label mb-1 text-muted-foreground">Earnings Intelligence</p>
                    <p className="leading-snug italic">
                      &ldquo;Management signaled NIM expansion in Q3 transcript analysis.&rdquo;
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-border/15 pt-4">
                <span className="editorial-label text-muted-foreground">Updated 2m ago</span>
                <span className="editorial-label text-muted-foreground">Upstox Integrated</span>
              </div>
            </div>
          </div>
        </div>

        <div className="editorial-label mx-auto mt-20 flex max-w-6xl flex-wrap items-center justify-between gap-x-10 gap-y-3 border-t border-border/20 pt-8 text-muted-foreground">
          <span>NSE Live Data</span>
          <span>Upstox OAuth</span>
          <span>Read-only Access</span>
          <span>SOC 2 Ready</span>
          <span>SEBI Disclaimer</span>
        </div>
      </section>

      {/* Workflow */}
      <section id="workflow" className="bg-muted px-6 py-20 md:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-16 inline-block border-b border-foreground pb-4 font-serif text-3xl md:text-4xl">
            The Workflow
          </h2>
          <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
            {WORKFLOW.map((s) => (
              <div key={s.n} className="space-y-4">
                <span className="block font-mono text-5xl text-primary/25">{s.n}</span>
                <h4 className="text-xl font-bold text-[oklch(0.15_0_0)]">{s.title}</h4>
                <p className="leading-relaxed text-foreground/80">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="platform" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 flex items-end justify-between border-b border-foreground pb-6">
            <h2 className="font-serif text-3xl md:text-4xl">Platform Capabilities</h2>
            <span className="editorial-label hidden text-muted-foreground md:inline">Six disciplines · one desk</span>
          </div>
          <div className="grid grid-cols-1 gap-x-12 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="border-l-2 border-primary pl-6">
                <span className="editorial-label mb-3 block text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                <h5 className="mb-2 text-lg font-bold text-[oklch(0.15_0_0)]">{f.title}</h5>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pull quote */}
      <section className="border-y border-border/20 px-6 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="font-serif text-3xl leading-snug text-[oklch(0.15_0_0)] md:text-4xl">
            &ldquo;It feels like Bloomberg&apos;s discipline with Linear&apos;s restraint. The timeline view alone changed
            how I think about my positions.&rdquo;
          </p>
          <div className="editorial-label mt-8 flex items-center justify-center gap-3 text-muted-foreground">
            <span className="h-px w-8 bg-foreground/30" />
            Anjali Verma · Portfolio Manager
            <span className="h-px w-8 bg-foreground/30" />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-[oklch(0.99_0.005_95)] px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-serif text-4xl md:text-5xl">Membership</h2>
            <p className="editorial-label text-muted-foreground">Monthly billing · Cancel anytime</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {plans.map((plan) => (
              <PricingCard key={plan.id} plan={plan} />
            ))}
          </div>
          <PricingComparisonTable className="mt-16" />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border/20 px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-12 inline-block border-b border-foreground pb-4 font-serif text-3xl md:text-4xl">
            Questions, answered.
          </h2>
          <div className="divide-y divide-border/20 border-y border-border/20">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-1 py-6 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-start justify-between gap-6 text-base font-medium text-[oklch(0.15_0_0)]">
                  {f.q}
                  <span className="mt-0.5 shrink-0 text-lg text-muted-foreground transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[oklch(0.15_0_0)] px-6 py-24 text-primary-foreground">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-6 font-serif text-4xl leading-tight md:text-5xl">
            Let an agent watch the market,
            <br />
            while you live your life.
          </h2>
          <p className="mb-10 text-primary-foreground/70">
            Start with a plan that fits your portfolio. Cancel anytime — your agents pause cleanly.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className="bg-primary-foreground px-8 py-4 text-sm font-bold uppercase tracking-[0.24em] text-[oklch(0.15_0_0)] transition-colors hover:bg-white"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="border border-primary-foreground/40 px-8 py-4 text-sm font-bold uppercase tracking-[0.24em] transition-colors hover:bg-primary-foreground/10"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/20 px-6 py-12 text-xs">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 grid grid-cols-2 gap-8 md:grid-cols-4">
            <div className="col-span-2">
              <div className="font-serif text-2xl font-bold text-[oklch(0.15_0_0)]">Daxch</div>
              <p className="mt-3 max-w-sm text-sm text-muted-foreground">
                An AI-powered stock monitoring assistant. You choose what to invest in — we help you watch it, quietly
                and continuously.
              </p>
            </div>
            <div>
              <div className="editorial-label mb-4 text-muted-foreground">Product</div>
              <ul className="space-y-2 text-sm">
                {[
                  { label: "Platform", href: "#platform" },
                  { label: "Pricing", href: "#pricing" },
                  { label: "Demo", href: "/demo" },
                  { label: "FAQ", href: "#faq" }
                ].map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-foreground/80 hover:text-primary">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="editorial-label mb-4 text-muted-foreground">Company</div>
              <ul className="space-y-2 text-sm">
                {[
                  { label: "Trust", href: "/trust" },
                  { label: "Terms", href: "/terms" },
                  { label: "Privacy", href: "/privacy" },
                  { label: "Refund Policy", href: "/refund-policy" },
                  { label: "Cancellation Policy", href: "/cancellation-policy" },
                  { label: "Sign up", href: "/signup" }
                ].map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-foreground/80 hover:text-primary">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="editorial-label flex flex-col items-start justify-between gap-3 border-t border-border/20 pt-6 text-muted-foreground md:flex-row md:items-center">
            <span>© {new Date().getFullYear()} Daxch Technologies</span>
            <span>Not a SEBI-registered investment advisor · Informational only</span>
          </div>
        </div>
      </footer>
      <div className="mx-auto max-w-6xl px-6 pb-6 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground/70">Disclaimer · </span>
        This platform provides AI-generated analysis for informational purposes only and does not provide investment
        advice. You are solely responsible for all investment and trading decisions.
      </div>
    </div>
  );
}
