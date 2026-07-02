"use client";

import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Disclaimer, GlassCard } from "@/components/daxch/primitives";
import { GUIDE_FAQ, GUIDE_FEATURES, GUIDE_JOURNEY, GUIDE_SECTIONS } from "@/lib/guide-content";

export default function GuidePage() {
  return (
    <AppShell
      title="How Daxch works"
      subtitle="You choose the stock and plan; AI monitors on schedule; you approve every trade."
      eyebrow="Product guide"
    >
      <GlassCard className="mb-8 border-amber-700/20 bg-amber-50/50 p-5 text-sm text-amber-950">
        Daxch is not a SEBI-registered investment advisor. All output is informational — validate against your own risk profile.
      </GlassCard>

      <section className="mb-10 space-y-4">
        <h2 className="font-serif text-2xl tracking-tight">How it works</h2>
        {GUIDE_SECTIONS.map((section) => (
          <GlassCard key={section.id} id={section.id} className="p-5">
            <h3 className="font-medium">{section.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.body}</p>
          </GlassCard>
        ))}
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-2xl tracking-tight">Your journey</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {GUIDE_JOURNEY.map((item) => (
            <Link key={item.step} href={item.href} className="group rounded-xl border border-border/15 bg-muted/40 p-4 hover:bg-muted/70">
              <div className="mb-3 grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {item.step}
              </div>
              <h3 className="font-medium">{item.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                Open <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-10 grid gap-4 lg:grid-cols-2" id="agents">
        <GlassCard>
          <h3 className="font-medium">Your plan vs exchange position</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Your plan</strong> — entry price, quantity, and goal stored for AI context. Not auto-synced from Demat.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Exchange position</strong> — real holdings from Upstox. P/L and square-off use this.
          </p>
        </GlassCard>
        <GlassCard>
          <h3 className="font-medium">Approvals & AI Units</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            AI never places surprise trades. You confirm every suggestion. Analysis and monitoring consume{" "}
            <Link href="/subscription" className="text-primary underline">AI Units</Link> from your monthly allowance.
          </p>
        </GlassCard>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-2xl tracking-tight">Features</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDE_FEATURES.map((f) => (
            <Link key={f.href} href={f.href} className="rounded-xl border border-border/15 bg-background p-5 hover:bg-muted/50">
              <h3 className="font-medium">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              <span className="mt-3 inline-block text-xs font-medium text-primary">Open →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-10" id="ai-units">
        <GlassCard>
          <h3 className="font-medium">Agent lifecycle</h3>
          <p className="mt-3 font-mono text-sm text-muted-foreground">
            Create → LIMIT order → Awaiting fill → Active monitoring → AI suggestion → You approve → Filled on exchange
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            If the entry order fails (e.g. broker rejection), the agent shows an error — not a false &quot;awaiting fill&quot; state.
          </p>
        </GlassCard>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-2xl tracking-tight">FAQ</h2>
        <div className="mt-4 space-y-3">
          {GUIDE_FAQ.map((item) => (
            <GlassCard key={item.q} className="p-5">
              <h3 className="text-sm font-medium">{item.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/agents/new" className="btn-editorial">
          <BookOpen className="h-3.5 w-3.5" /> New Agent
        </Link>
        <Link href="/broker" className="inline-flex items-center gap-2 rounded-sm border border-border/20 px-4 py-2.5 text-sm font-medium hover:bg-muted">
          Connect Broker
        </Link>
        <Link href="/research" className="inline-flex items-center gap-2 rounded-sm border border-border/20 px-4 py-2.5 text-sm font-medium hover:bg-muted">
          Run Research
        </Link>
      </div>

      <div className="mt-10">
        <Disclaimer />
      </div>
    </AppShell>
  );
}
