import Link from "next/link";
import { ArrowRight, Check, Circle, Sparkles } from "lucide-react";

type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  href?: string;
  optional?: boolean;
  hint?: string;
};

export function FirstRunChecklist({ items }: { items: ChecklistItem[] }) {
  const incomplete = items.filter((i) => !i.done);
  if (incomplete.length === 0) return null;

  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / items.length) * 100);

  return (
    <div className="mb-8 border border-[color:var(--ink)]/12 bg-[color:var(--paper-3)]">
      <div className="flex items-center justify-between border-b border-[color:var(--ink)]/10 px-6 py-4">
        <div className="flex items-baseline gap-3">
          <Sparkles className="h-4 w-4 text-[color:var(--forest)]" />
          <h3 className="font-serif text-lg text-[color:var(--ink)]">Get set up</h3>
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[color:var(--ink-2)]/60">
            {done} of {items.length} · {pct}%
          </span>
        </div>
        <div className="hidden h-1 w-40 bg-[color:var(--paper-2)] md:block">
          <div className="h-full bg-[color:var(--forest)]" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-1 divide-y divide-[color:var(--ink)]/10 md:grid-cols-2 md:divide-x md:divide-y-0">
        {items.map((item) => {
          const content = (
            <>
              <div
                className={
                  "grid h-6 w-6 shrink-0 place-items-center border " +
                  (item.done
                    ? "border-[color:var(--forest)] bg-[color:var(--forest)] text-[color:var(--paper)]"
                    : "border-[color:var(--ink)]/30 bg-[color:var(--paper)] text-[color:var(--ink-2)]/50")
                }
              >
                {item.done ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={
                    "text-sm " +
                    (item.done ? "text-[color:var(--ink-2)]/60 line-through" : "text-[color:var(--ink)]")
                  }
                >
                  {item.label}
                  {item.optional && (
                    <span className="ml-1 font-mono text-[10px] uppercase text-[color:var(--ink-2)]/50">
                      (optional)
                    </span>
                  )}
                </div>
                {item.hint && (
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--ink-2)]/50">
                    {item.hint}
                  </div>
                )}
              </div>
              {!item.done && item.href && (
                <ArrowRight className="h-3.5 w-3.5 text-[color:var(--ink-2)]/40 group-hover:text-[color:var(--ink)]" />
              )}
            </>
          );

          if (item.href && !item.done) {
            return (
              <Link
                key={item.id}
                href={item.href}
                className="group flex items-center gap-3 px-6 py-4 hover:bg-[color:var(--paper-2)]/60"
              >
                {content}
              </Link>
            );
          }

          return (
            <div key={item.id} className="flex items-center gap-3 px-6 py-4">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
