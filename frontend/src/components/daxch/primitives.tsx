import { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function GlassCard({
  className,
  children,
  editorialShadow,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { editorialShadow?: boolean }) {
  return (
    <div
      {...props}
      className={cn(
        "relative border border-[color:oklch(0.3_0.006_270/0.12)] bg-[color:var(--paper-3)] p-4 transition-colors sm:p-6",
        editorialShadow && "border-[color:var(--ink)] shadow-[var(--ink-shadow-sm)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function InkCard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "border border-[color:var(--ink)] bg-[color:var(--paper-3)] p-6 shadow-[var(--ink-shadow-sm)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Plate({
  eyebrow,
  value,
  delta,
  hint,
  up,
  warn,
  className
}: {
  eyebrow: string;
  value: ReactNode;
  delta?: string;
  hint?: string;
  up?: boolean;
  warn?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("p-5", className)}>
      <div className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-[color:var(--ink-2)]/60">
        {eyebrow}
      </div>
      <div className="font-mono text-2xl tracking-tight text-[color:var(--ink)] md:text-[26px]">{value}</div>
      {(delta || hint) && (
        <div className="mt-2 font-mono text-[11px]">
          {delta && (
            <span
              className={cn(
                "font-medium",
                warn
                  ? "text-[color:oklch(0.42_0.13_55)]"
                  : up
                    ? "text-[color:var(--forest)]"
                    : "text-[color:var(--ink-2)]"
              )}
            >
              {delta}
            </span>
          )}
          {hint && <span className="text-[color:var(--ink-2)]/60"> · {hint}</span>}
        </div>
      )}
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
    trend === "up"
      ? "text-[color:var(--forest)]"
      : trend === "down"
        ? "text-[color:var(--destructive)]"
        : "text-[color:var(--ink-2)]/60";

  return (
    <div className="flex flex-col gap-3 border border-[color:oklch(0.3_0.006_270/0.12)] bg-[color:var(--paper-3)] p-5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-[color:var(--ink-2)]/60">
          {label}
        </span>
        {icon && <span className="text-[color:var(--ink-2)]/50">{icon}</span>}
      </div>
      <div className="space-y-1">
        <div className="font-mono text-3xl tracking-tight text-[color:var(--ink)]">{value}</div>
        <div className="flex items-center gap-2 text-xs">
          {delta && <span className={cn("font-medium", trendColor)}>{delta}</span>}
          {hint && <span className="text-[color:var(--ink-2)]/60">{hint}</span>}
        </div>
      </div>
    </div>
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
    neutral: "border-[color:oklch(0.3_0.006_270/0.25)] bg-transparent text-[color:var(--ink-2)]",
    success: "border-[color:var(--forest)] bg-[color:var(--forest-soft)] text-[color:var(--forest)]",
    warning:
      "border-[color:oklch(0.55_0.14_55/0.5)] bg-[color:oklch(0.62_0.14_55/0.15)] text-[color:oklch(0.42_0.13_55)]",
    danger:
      "border-[color:oklch(0.52_0.19_27/0.5)] bg-[color:oklch(0.52_0.19_27/0.1)] text-[color:var(--destructive)]",
    primary: "border-[color:var(--ink)] bg-[color:var(--ink)] text-[color:var(--paper)]"
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em]",
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
      ? "bg-[color:var(--forest)]"
      : variant === "warning"
        ? "bg-[color:oklch(0.62_0.14_55)]"
        : variant === "danger"
          ? "bg-[color:var(--destructive)]"
          : "bg-[color:var(--ink-2)]/50";

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
        "border-l-2 border-[color:var(--ink)] bg-[color:var(--paper-2)] px-4 py-3 text-[11px] leading-relaxed text-[color:var(--ink-2)]",
        className
      )}
    >
      <span className="mr-2 font-mono uppercase tracking-[0.2em] text-[color:var(--ink)]">Disclaimer ·</span>
      Daxch provides AI-assisted research and monitoring. It is not investment advice. You remain solely responsible
      for all decisions.
    </div>
  );
}

export function AlertBanner({
  variant = "warning",
  title,
  children,
  className,
  action
}: {
  variant?: "warning" | "error" | "info";
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  const toneCls =
    variant === "error"
      ? "border-[color:var(--destructive)] bg-[color:oklch(0.52_0.19_27/0.06)]"
      : variant === "warning"
        ? "border-[color:oklch(0.55_0.14_55/0.7)] bg-[color:oklch(0.62_0.14_55/0.1)]"
        : "border-[color:var(--ink)] bg-[color:var(--paper-2)]";

  return (
    <div className={cn("flex flex-wrap items-start gap-4 border-l-2 px-5 py-4", toneCls, className)}>
      <div className="min-w-0 flex-1">
        {title && (
          <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[color:var(--ink)]">
            {title}
          </div>
        )}
        <div className="text-sm text-[color:var(--ink-2)]">{children}</div>
      </div>
      {action}
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
  const pad = size === "xs" ? "px-2 py-1" : "px-3 py-1.5";
  const text = size === "xs" ? "text-[10px]" : "text-[10px]";

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div className={cn("inline-flex min-w-max border border-[color:var(--ink)]/15", text)}>
        {options.map((option, i) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              "shrink-0 border-r border-[color:var(--ink)]/15 font-mono uppercase tracking-[0.2em] transition-colors last:border-r-0",
              pad,
              value === option
                ? "bg-[color:var(--ink)] font-bold text-[color:var(--paper)]"
                : "text-[color:var(--ink-2)]/70 hover:bg-[color:var(--paper-2)]"
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChartCardHeader({
  title,
  tabs,
  className
}: {
  title: ReactNode;
  tabs?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 border-b border-[color:var(--ink)]/10 pb-6 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">{title}</div>
      {tabs && <div className="w-full shrink-0 sm:w-auto sm:self-auto">{tabs}</div>}
    </div>
  );
}

export function Sparkline({
  data,
  color = "var(--forest)",
  className,
  height = 48
}: {
  data: number[];
  color?: string;
  className?: string;
  height?: number;
}) {
  if (data.length < 2) return null;

  const w = 160;
  const h = height;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 6) - 3}`);
  const d = `M ${pts.join(" L ")}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("w-full", className)} preserveAspectRatio="none">
      <path d={d} fill="none" stroke={color} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AreaChart({
  data,
  height = 240,
  color = "var(--forest)",
  className,
  wrapperClassName
}: {
  data: number[];
  height?: number;
  color?: string;
  className?: string;
  wrapperClassName?: string;
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

  return (
    <div className={cn("w-full", wrapperClassName ?? className)} style={wrapperClassName ? undefined : { height }}>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <pattern id="grid-pat" width="80" height="40" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 40" fill="none" stroke="oklch(0.3 0.006 270 / 0.06)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={w} height={h} fill="url(#grid-pat)" />
        <path d={area} fill="url(#area-fill)" />
        <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function ThinkingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="dot-think h-1.5 w-1.5 rounded-full bg-[color:var(--forest)]" style={{ animationDelay: "0ms" }} />
      <span className="dot-think h-1.5 w-1.5 rounded-full bg-[color:var(--forest)]" style={{ animationDelay: "150ms" }} />
      <span className="dot-think h-1.5 w-1.5 rounded-full bg-[color:var(--forest)]" style={{ animationDelay: "300ms" }} />
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
        <div className={cn("flex items-center gap-3", align === "center" && "justify-center")}>
          <span className="h-px w-8 bg-[color:var(--ink)]" />
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-[color:var(--ink-2)]">
            {eyebrow}
          </span>
        </div>
      )}
      <h2 className="font-serif text-balance text-3xl tracking-tight text-[color:var(--ink)] md:text-4xl">{title}</h2>
      {description && (
        <p className="text-balance text-base text-[color:var(--ink-2)] md:text-lg">{description}</p>
      )}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-[color:var(--ink-2)]/70",
        className
      )}
    >
      {children}
    </span>
  );
}
