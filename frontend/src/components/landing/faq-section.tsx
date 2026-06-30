"use client";

import { MotionSection } from "@/components/landing/motion-section";

type FaqItem = { q: string; a: string };

export function FaqSection({ items }: { items: FaqItem[] }) {
  return (
    <section id="faq" className="relative mx-auto max-w-3xl px-6 py-12">
      <h2 className="text-center text-3xl font-semibold tracking-tight">Questions, answered.</h2>

      <MotionSection className="mt-12" stagger={false}>
        <div className="divide-y divide-white/5 rounded-2xl border border-white/5 bg-white/[0.02]">
          {items.map((f) => (
            <details key={f.q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-start justify-between gap-4 text-sm font-medium">
                {f.q}
                <span className="mt-0.5 text-muted-foreground transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </MotionSection>
    </section>
  );
}
