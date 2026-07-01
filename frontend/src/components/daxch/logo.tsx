import { cn } from "@/lib/utils";

export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative grid h-8 w-8 place-items-center rounded-sm bg-gradient-to-br from-primary to-primary/70 shadow-card">
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
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-600 ring-2 ring-background pulse-ring" />
      </div>
      {showWordmark && (
        <span className="font-serif text-lg font-bold tracking-tight text-[oklch(0.15_0_0)]">Daxch</span>
      )}
    </div>
  );
}
