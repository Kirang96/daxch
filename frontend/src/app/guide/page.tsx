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
            {"lifecycle" in section && section.lifecycle && (
              <p className="mt-3 font-mono text-xs text-muted-foreground">{section.lifecycle}</p>
            )}
          </GlassCard>
        ))}
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-2xl tracking-tight">Your journey</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <section className="mb-10">
        <h2 className="font-serif text-2xl tracking-tight">Features</h2>
        <GlassCard className="mt-6 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {GUIDE_FEATURES.map((f) => (
              <Link key={f.href} href={f.href} className="rounded-lg border border-border/10 px-3 py-2.5 hover:bg-muted/50">
                <div className="font-medium text-sm">{f.title}</div>
                <div className="text-xs text-muted-foreground">{f.desc}</div>
              </Link>
            ))}
          </div>
        </GlassCard>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-2xl tracking-tight">FAQ</h2>
        <GlassCard className="mt-4 divide-y divide-border/15 p-0">
          {GUIDE_FAQ.map((item) => (
            <details key={item.q} className="group px-5 py-1">
              <summary className="cursor-pointer list-none py-3 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                {item.q}
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </GlassCard>
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
