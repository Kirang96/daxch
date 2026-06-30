"use client";

import { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

export function LandingCard({
  children,
  className,
  highlighted = false
}: {
  children: ReactNode;
  className?: string;
  highlighted?: boolean;
}) {
  const reduceMotion = useReducedMotion();

  const baseClass = cn(
    "glass rounded-2xl p-6 transition-colors duration-300",
    highlighted && "border-primary/40 ring-1 ring-primary/30 shadow-[0_4px_24px_-4px_oklch(var(--primary)/0.15)]",
    !highlighted && "hover:border-primary/20",
    className
  );

  if (reduceMotion) {
    return <div className={baseClass}>{children}</div>;
  }

  return (
    <motion.div
      className={baseClass}
      whileHover={{ y: -4, transition: { type: "spring", stiffness: 400, damping: 25 } }}
    >
      {children}
    </motion.div>
  );
}
