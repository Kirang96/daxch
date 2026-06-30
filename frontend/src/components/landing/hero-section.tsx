"use client";

import Link from "next/link";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

import { ProductPreview } from "@/components/landing/product-preview";

export function HeroSection() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const previewY = useTransform(scrollYProgress, [0, 1], [0, 24]);

  return (
    <section ref={ref} className="relative mx-auto max-w-7xl px-6 pb-24 pt-20 md:pb-32 md:pt-28">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <motion.div
          className="text-center lg:text-left"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border/15 bg-muted px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles className="pulse-ring h-3 w-3 text-primary" /> AI Stock Monitoring · You approve every trade
          </span>
          <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
            AI watches your stocks on your terms
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance text-base text-muted-foreground md:text-lg lg:mx-0">
            Dedicated AI agents monitor your positions — fundamentals, technicals, news, and your thesis. You review
            suggestions and approve every trade sent to Upstox.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link
              href="/signup?plan=starter"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-[0_10px_30px_-10px_oklch(0.55_0.22_277/0.8)] transition-all hover:brightness-110"
            >
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-xl border border-border/20 bg-muted px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
            >
              <Play className="h-4 w-4" /> See how it works
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Paid plans from ₹499/mo · Daxch does not recommend stocks
          </p>
        </motion.div>

        <div className="hidden lg:block">
          {reduceMotion ? (
            <ProductPreview />
          ) : (
            <motion.div style={{ y: previewY }}>
              <ProductPreview />
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
