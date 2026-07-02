import { cn } from "@/lib/utils";

import { LogoMark } from "./logo-mark";

export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={32} showPulse />
      {showWordmark && (
        <span className="font-serif text-xl font-bold tracking-tight text-[color:var(--ink)]">Daxch</span>
      )}
    </div>
  );
}
