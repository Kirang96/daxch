import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
  fullWidth?: boolean;
};

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-[oklch(0.15_0_0)] focus-visible:ring-primary/40",
  secondary: "border border-border/20 bg-muted text-foreground hover:bg-background focus-visible:ring-primary/40",
  danger: "bg-destructive text-destructive-foreground hover:opacity-90 focus-visible:ring-destructive/40",
  ghost: "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-primary/40"
};

export function Button({ variant = "primary", fullWidth = false, className = "", children, ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-sm px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60",
        variantClasses[variant],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
