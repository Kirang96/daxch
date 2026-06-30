"use client";

import { Activity, Bot, Check, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

import { Badge, GlassCard, Sparkline } from "@/components/daxch/primitives";

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15, delayChildren: 0.2 }
  }
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 200, damping: 22 }
  }
};

function FloatingCard({
  children,
  className,
  floatDelay = 0
}: {
  children: React.ReactNode;
  className?: string;
  floatDelay?: number;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <GlassCard className={className}>{children}</GlassCard>;
  }

  return (
    <motion.div variants={cardVariants}>
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{
          y: { duration: 5 + floatDelay, repeat: Infinity, ease: "easeInOut", delay: floatDelay }
        }}
      >
        <GlassCard className={className}>{children}</GlassCard>
      </motion.div>
    </motion.div>
  );
}

export function ProductPreview() {
  const reduceMotion = useReducedMotion();

  const content = (
    <div className="space-y-4">
      <FloatingCard className="w-full max-w-md" floatDelay={0}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-medium">Agent · INFY</div>
              <div className="text-xs text-muted-foreground">Suggestion pending your approval</div>
            </div>
          </div>
          <Badge variant="warning">Review</Badge>
        </div>
        <Sparkline data={[12, 14, 13, 16, 15, 17, 19, 18, 20, 22, 21, 23, 25]} color="oklch(var(--success))" className="mt-5" height={70} />
        <div className="mt-4 flex gap-2">
          <button type="button" className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
            Approve trade
          </button>
          <button type="button" className="flex-1 rounded-lg border border-border/20 px-3 py-2 text-xs font-medium">
            Reject
          </button>
        </div>
      </FloatingCard>

      <FloatingCard className="ml-6 w-full max-w-sm" floatDelay={0.8}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="h-3.5 w-3.5 text-primary" /> Exchange trades
        </div>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2">
            <span>INFY · Buy 10</span>
            <Badge variant="success">
              <Check className="h-3 w-3" /> Filled
            </Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2 text-muted-foreground">
            <span>Waiting for your approval</span>
            <span className="text-xs">—</span>
          </div>
        </div>
      </FloatingCard>

      <FloatingCard className="ml-12 w-full max-w-xs" floatDelay={1.6}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> You stay in control
        </div>
        <p className="mt-2 text-sm text-muted-foreground">AI watches. You approve every trade sent to Upstox.</p>
      </FloatingCard>
    </div>
  );

  if (reduceMotion) {
    return content;
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants}>
      {content}
    </motion.div>
  );
}
