"use client";

import { MotionItem, MotionReveal, MotionSection } from "@/components/landing/motion-section";
import { LandingCard } from "@/components/landing/landing-card";

type Step = { step: string; title: string; desc: string };

export function HowItWorksSteps({ steps }: { steps: Step[] }) {
  return (
    <section className="relative mx-auto max-w-7xl px-6 py-16">
      <MotionReveal>
        <h2 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">How it works</h2>
      </MotionReveal>

      <MotionSection className="relative mt-10">
        <div className="hidden lg:block" aria-hidden>
          <svg className="absolute left-[12.5%] right-[12.5%] top-10 h-px w-[75%] overflow-visible" preserveAspectRatio="none">
            <line
              x1="0"
              y1="0"
              x2="100%"
              y2="0"
              stroke="oklch(var(--primary) / 0.25)"
              strokeWidth="1"
              strokeDasharray="6 6"
              className="dash-flow"
            />
          </svg>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((item) => (
            <MotionItem key={item.step}>
              <LandingCard>
                <div className="relative mb-4 grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary ring-2 ring-primary/20">
                  {item.step}
                </div>
                <h3 className="font-medium">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
              </LandingCard>
            </MotionItem>
          ))}
        </div>
      </MotionSection>
    </section>
  );
}
