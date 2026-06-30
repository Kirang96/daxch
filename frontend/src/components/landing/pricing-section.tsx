"use client";

import Link from "next/link";
import { Check } from "lucide-react";

import { LandingCard } from "@/components/landing/landing-card";
import { MotionItem, MotionReveal, MotionSection } from "@/components/landing/motion-section";

type Plan = {
  id: string;
  name: string;
  price: string;
  desc: string;
  features: string[];
  cta: string;
  highlighted: boolean;
};

export function PricingSection({ plans }: { plans: Plan[] }) {
  return (
    <section id="pricing" className="relative mx-auto max-w-7xl px-6 py-24">
      <MotionReveal>
        <h2 className="text-center text-3xl font-semibold tracking-tight md:text-4xl">Three plans. No hidden fees.</h2>
      </MotionReveal>

      <MotionSection className="mx-auto mt-14 grid max-w-6xl gap-6 md:grid-cols-3">
        {plans.map((p) => (
          <MotionItem key={p.name}>
            <LandingCard highlighted={p.highlighted}>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-medium">{p.name}</h3>
                {p.highlighted && (
                  <span className="shimmer rounded-full border border-primary/25 bg-primary/15 px-2.5 py-0.5 text-[11px]">
                    Most popular
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">{p.price}</span>
                <span className="text-sm text-muted-foreground">/ month</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
              <ul className="mt-6 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <Check className="h-4 w-4 text-emerald-400" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                href={`/signup?plan=${p.id}`}
                className={
                  p.highlighted
                    ? "mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_4px_16px_-4px_oklch(0.52_0.22_277/0.4)] hover:brightness-110"
                    : "mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/20 bg-muted px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/70"
                }
              >
                {p.cta}
              </Link>
            </LandingCard>
          </MotionItem>
        ))}
      </MotionSection>
    </section>
  );
}
