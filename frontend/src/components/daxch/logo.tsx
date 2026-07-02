import { cn } from "@/lib/utils";

export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative grid h-8 w-8 place-items-center border border-[color:var(--ink)] bg-[color:var(--paper)]">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 text-[color:var(--ink)]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 16l4-6 4 3 4-9 4 12" />
        </svg>
        <span className="pulse-ring absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[color:var(--forest)]" />
      </div>
      {showWordmark && (
        <span className="font-serif text-xl font-bold tracking-tight text-[color:var(--ink)]">Daxch</span>
      )}
    </div>
  );
}
