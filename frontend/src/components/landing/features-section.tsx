"use client";

import { Activity, Bot, LucideIcon, Newspaper, PieChart, Plug, ShieldAlert } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { LandingCard } from "@/components/landing/landing-card";
import { MotionItem, MotionReveal, MotionSection } from "@/components/landing/motion-section";

const iconMap: Record<string, LucideIcon> = {
  Bot,
  Activity,
  Plug,
  PieChart,
  ShieldAlert,
  Newspaper
};

type Feature = { icon: keyof typeof iconMap; title: string; desc: string };

export function FeaturesSection({ features }: { features: Feature[] }) {
  const reduceMotion = useReducedMotion();

  return (
    <section id="features" className="relative mx-auto max-w-7xl px-6 py-10">
      <MotionReveal>
        <div className="mb-8 text-center">
          <span className="inline-flex items-center rounded-full border border-border/15 bg-muted px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Features
          </span>
        </div>
      </MotionReveal>

      <MotionSection className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => {
          const Icon = iconMap[f.icon];
          return (
            <MotionItem key={f.title}>
              <LandingCard>
                {reduceMotion ? (
                  <div className="mb-5 grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                    <Icon className="h-5 w-5" />
                  </div>
                ) : (
                  <motion.div
                    className="mb-5 grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20"
                    whileHover={{ scale: 1.08 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  >
                    <Icon className="h-5 w-5" />
                  </motion.div>
                )}
                <h3 className="text-lg font-medium tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </LandingCard>
            </MotionItem>
          );
        })}
      </MotionSection>
    </section>
  );
}
