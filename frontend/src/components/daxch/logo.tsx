import { cn } from "@/lib/utils";

export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/40 shadow-[0_0_0_1px_oklch(1_0_0/0.08),0_8px_24px_-8px_oklch(0.55_0.22_277/0.6)]">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 text-primary-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 16l4-6 4 3 4-9 4 12" />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-background pulse-ring" />
      </div>
      {showWordmark && <span className="text-[15px] font-semibold tracking-tight">Daxch</span>}
    </div>
  );
}

