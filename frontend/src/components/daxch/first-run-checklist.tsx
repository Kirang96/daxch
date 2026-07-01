import Link from "next/link";
import { Check, Circle } from "lucide-react";

import { GlassCard } from "@/components/daxch/primitives";
import { cn } from "@/lib/utils";

type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  href?: string;
  optional?: boolean;
};

export function FirstRunChecklist({ items }: { items: ChecklistItem[] }) {
  const incomplete = items.filter((i) => !i.done);
  if (incomplete.length === 0) return null;

  return (
    <GlassCard className="mb-6">
      <h3 className="text-sm font-medium">Get started</h3>
      <p className="mt-1 text-xs text-muted-foreground">Complete these steps to get the most from Daxch.</p>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            {item.href && !item.done ? (
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-lg border border-border/15 bg-muted/60 px-3 py-2.5 text-sm hover:border-primary/20"
              >
                <ItemIcon done={item.done} />
                <span>
                  {item.label}
                  {item.optional && <span className="ml-1 text-xs text-muted-foreground">(optional)</span>}
                </span>
              </Link>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-border/15 bg-muted/60 px-3 py-2.5 text-sm">
                <ItemIcon done={item.done} />
                <span className={item.done ? "text-muted-foreground line-through" : ""}>
                  {item.label}
                  {item.optional && <span className="ml-1 text-xs text-muted-foreground">(optional)</span>}
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

function ItemIcon({ done }: { done: boolean }) {
  return done ? (
    <Check className="h-4 w-4 shrink-0 text-emerald-500" />
  ) : (
    <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
  );
}
