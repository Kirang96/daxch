"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

export function CtaBanner() {
  const reduceMotion = useReducedMotion();

  const inner = (
  <div className="glass relative overflow-hidden rounded-2xl p-10 text-center md:p-14">
    <div aria-hidden className="gradient-pulse absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
    <div className="relative">
      <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
        Let an AI agent watch your portfolio,
        <br className="hidden md:block" /> while you live your life.
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-balance text-muted-foreground">
        Paid plans from ₹499/mo. Cancel anytime.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:brightness-110"
        >
          Get started <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-xl border border-border/20 bg-background/60 px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Sign in
        </Link>
      </div>
    </div>
  </div>
  );

  if (reduceMotion) {
    return <section className="relative mx-auto max-w-5xl px-6 py-24">{inner}</section>;
  }

  return (
    <section className="relative mx-auto max-w-5xl px-6 py-24">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ type: "spring", stiffness: 200, damping: 24 }}
      >
        {inner}
      </motion.div>
    </section>
  );
}
