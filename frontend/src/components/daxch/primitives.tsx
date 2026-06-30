import { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function GlassCard({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cn("glass rounded-2xl p-6 transition-all duration-300 hover:shadow-[0_4px_24px_-4px_oklch(var(--border)/0.18)]", className)}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  delta,
  trend = "up",
  hint,
  icon
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  trend?: "up" | "down" | "flat";
  hint?: string;
  icon?: ReactNode;
}) {
  const trendColor =
    trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-muted-foreground";

  return (
    <GlassCard className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        {icon && <span className="text-muted-foreground/70">{icon}</span>}
      </div>
      <div className="space-y-1">
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
        <div className="flex items-center gap-2 text-xs">
          {delta && <span className={cn("font-medium", trendColor)}>{delta}</span>}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      </div>
    </GlassCard>
  );
}

export function Badge({
  children,
  variant = "neutral",
  className
}: {
  children: ReactNode;
  variant?: "neutral" | "success" | "warning" | "danger" | "primary";
  className?: string;
}) {
  const styles: Record<string, string> = {
    neutral: "bg-muted text-foreground/70 border-border/15",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-red-50 text-red-600 border-red-200",
    primary: "bg-primary/10 text-primary border-primary/20"
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusDot({ variant = "success" }: { variant?: "success" | "warning" | "danger" | "neutral" }) {
  const c =
    variant === "success"
      ? "bg-emerald-400"
      : variant === "warning"
        ? "bg-amber-400"
        : variant === "danger"
          ? "bg-red-400"
          : "bg-muted-foreground";

  return (
    <span className="relative inline-flex h-2 w-2">
      <span className={cn("absolute inset-0 rounded-full opacity-60 animate-ping", c)} />
      <span className={cn("relative h-2 w-2 rounded-full", c)} />
    </span>
  );
}

export function Disclaimer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/15 bg-muted/50 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground",
        className
      )}
    >
      <span className="font-medium text-foreground/60">Disclaimer · </span>
      Daxch provides AI-assisted research and monitoring. It does not provide investment advice. Users remain solely
      responsible for all investment decisions.
    </div>
  );
}

export function AlertBanner({
  variant = "warning",
  title,
  children,
  className
}: {
  variant?: "warning" | "error" | "info";
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const styles = {
    warning: "border-amber-300/70 bg-amber-50 text-amber-950",
    error: "border-red-300/70 bg-red-50 text-red-900",
    info: "border-border/20 bg-muted/60 text-foreground"
  };
  const titleStyles = {
    warning: "text-amber-900",
    error: "text-red-900",
    info: "text-foreground"
  };

  return (
    <div className={cn("rounded-xl border p-4 text-sm", styles[variant], className)}>
      {title && <div className={cn("flex items-center gap-2 font-medium", titleStyles[variant])}>{title}</div>}
      <div className={cn(title ? "mt-1 text-xs leading-relaxed text-inherit/90" : "text-xs leading-relaxed")}>{children}</div>
    </div>
  );
}

export function TimeframeTabs<T extends string>({
  value,
  onChange,
  options,
  size = "sm"
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly T[];
  size?: "xs" | "sm";
}) {
  const pad = size === "xs" ? "px-2 py-0.5" : "px-2.5 py-1";
  const text = size === "xs" ? "text-[11px]" : "text-xs";

  return (
    <div className={cn("flex gap-1 rounded-lg border border-border/15 bg-muted/60 p-1", text)}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "rounded-md transition-colors",
            pad,
            value === option
              ? "bg-primary/12 font-semibold text-primary shadow-sm ring-1 ring-primary/20"
              : "font-medium text-muted-foreground hover:bg-background hover:text-foreground"
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function Sparkline({
  data,
  color = "oklch(var(--chart-1))",
  className,
  height = 48
}: {
  data: number[];
  color?: string;
  className?: string;
  height?: number;
}) {
  const w = 160;
  const h = height;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 6) - 3}`);
  const d = `M ${pts.join(" L ")}`;
  const area = `${d} L ${w},${h} L 0,${h} Z`;
  const id = `sg-${toHash(`${data.join(",")}-${color}`)}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("w-full", className)} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AreaChart({
  data,
  height = 240,
  color = "oklch(var(--chart-1))",
  className
}: {
  data: number[];
  height?: number;
  color?: string;
  className?: string;
}) {
  const w = 800;
  const h = height;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 24) - 12}`);
  const d = `M ${pts.join(" L ")}`;
  const area = `${d} L ${w},${h} L 0,${h} Z`;

  const id = `ac-${toHash(`${data.join(",")}-${color}`)}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("w-full", className)} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <pattern id={`${id}-grid`} width="80" height="40" patternUnits="userSpaceOnUse">
          <path d="M 80 0 L 0 0 0 40" fill="none" stroke="oklch(0.24 0.01 258 / 0.07)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={w} height={h} fill={`url(#${id}-grid)`} />
      <path d={area} fill={`url(#${id}-fill)`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ThinkingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-primary dot-think" style={{ animationDelay: "0ms" }} />
      <span className="h-1.5 w-1.5 rounded-full bg-primary dot-think" style={{ animationDelay: "150ms" }} />
      <span className="h-1.5 w-1.5 rounded-full bg-primary dot-think" style={{ animationDelay: "300ms" }} />
    </span>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  align = "left"
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div className={cn("space-y-3", align === "center" && "mx-auto max-w-2xl text-center")}>
      {eyebrow && (
        <div className={cn("inline-flex", align === "center" && "w-full justify-center")}>
          <span className="inline-flex items-center gap-2 rounded-full border border-border/15 bg-muted px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </span>
        </div>
      )}
      <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
      {description && <p className="text-balance text-base text-muted-foreground md:text-lg">{description}</p>}
    </div>
  );
}

function toHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

