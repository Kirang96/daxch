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
        <li key={feature} className={cn("flex items-start gap-3", itemClassName)}>
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}
