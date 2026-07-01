import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  features: string[];
  className?: string;
  itemClassName?: string;
};

export function PlanFeaturesList({ features, className, itemClassName }: Props) {
  return (
    <ul className={cn("space-y-2 text-sm", className)}>
      {features.map((feature) => (
        <li key={feature} className={cn("flex items-start gap-2", itemClassName)}>
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}
