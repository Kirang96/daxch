import { ReactNode } from "react";

type Variant = "neutral" | "active" | "warning" | "danger" | "info";

const variantMap: Record<Variant, string> = {
  neutral: "border border-border/15 bg-muted text-foreground/80",
  active: "border border-emerald-300/60 bg-emerald-50 text-emerald-800",
  warning: "border border-amber-300/60 bg-amber-50 text-amber-800",
  danger: "border border-red-300/60 bg-red-50 text-red-800",
  info: "border border-primary/25 bg-primary/10 text-primary"
};

type Props = {
  children: ReactNode;
  variant?: Variant;
  className?: string;
};

export function Badge({ children, variant = "neutral", className = "" }: Props) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${variantMap[variant]} ${className}`}>
      {children}
    </span>
  );
}

