"use client";

import { cn } from "@/lib/utils";
import { useChartHover } from "@/hooks/use-chart-hover";

type StockPriceChartProps = {
  prices: number[];
  timestamps?: string[];
  high?: number | null;
  low?: number | null;
  ltp?: number | null;
  entryPrice?: number | null;
  interval?: string;
  className?: string;
  height?: number;
};

function formatPrice(value: number) {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateLabel(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts.slice(0, 10);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function StockPriceChart({
  prices,
  timestamps = [],
  high,
  low,
  ltp,
  entryPrice,
  interval = "day",
  className,
  height = 220,
}: StockPriceChartProps) {
  if (prices.length < 2) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Chart data unavailable.</p>;
  }

  const min = Math.min(...prices, entryPrice ?? Infinity, ltp ?? Infinity);
  const max = Math.max(...prices, entryPrice ?? -Infinity, ltp ?? -Infinity);
  const first = prices[0];
  const last = prices[prices.length - 1];
  const changePct = first > 0 ? ((last - first) / first) * 100 : 0;

  const w = 800;
  const h = height;
  const padTop = 12;
  const padBottom = 28;
  const chartH = h - padTop - padBottom;
  const step = w / (prices.length - 1);

  const { svgRef, hover, handleMouseMove, handleMouseLeave, yFor } = useChartHover({
    prices,
    timestamps,
    plotWidth: w,
    plotHeight: h,
    padTop,
    padBottom,
    min,
    max,
    formatLabel: (ts) => formatDateLabel(ts),
  });

  const pts = prices.map((v, i) => `${i * step},${yFor(v)}`);
  const d = `M ${pts.join(" L ")}`;
  const area = `${d} L ${w},${h - padBottom} L 0,${h - padBottom} Z`;

  const tickIndexes = [0, Math.floor((prices.length - 1) / 2), prices.length - 1];
  const yTicks = [min, (min + max) / 2, max];

  const entryY = entryPrice != null ? yFor(entryPrice) : null;
  const ltpY = ltp != null ? yFor(ltp) : null;

  return (
    <div className={cn("relative w-full", className)}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 text-xs">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {interval === "day" ? "Daily" : interval} chart
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            H {formatPrice(high ?? max)} · L {formatPrice(low ?? min)} ·{" "}
            <span className={changePct >= 0 ? "text-emerald-700" : "text-red-700"}>
              {changePct >= 0 ? "+" : ""}
              {changePct.toFixed(2)}%
            </span>
          </div>
        </div>
        {ltp != null && (
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">LTP</div>
            <div className="text-lg font-semibold tabular-nums">{formatPrice(ltp)}</div>
          </div>
        )}
      </div>

      <div className="relative">
        {hover && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-border/20 bg-background/95 px-2.5 py-1.5 text-xs shadow-md backdrop-blur-sm"
            style={{
              left: `${(hover.svgX / w) * 100}%`,
              top: 8,
              transform: hover.svgX > w * 0.65 ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            <div className="font-semibold tabular-nums">{formatPrice(hover.price)}</div>
            <div className="text-muted-foreground">{hover.label}</div>
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={`0 0 ${w} ${h}`}
          className="h-44 w-full sm:h-56 md:h-[220px]"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="stock-area-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(var(--primary))" stopOpacity="0.22" />
              <stop offset="100%" stopColor="oklch(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>

          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={0}
                y1={yFor(tick)}
                x2={w}
                y2={yFor(tick)}
                stroke="oklch(0.3 0.006 270 / 0.08)"
                strokeWidth={1}
              />
              <text x={4} y={yFor(tick) - 4} className="fill-muted-foreground text-[10px]">
                {formatPrice(tick)}
              </text>
            </g>
          ))}

          {entryY != null && (
            <>
              <line x1={0} y1={entryY} x2={w} y2={entryY} stroke="oklch(0.55 0.14 55)" strokeDasharray="4 4" strokeWidth={1.5} />
              <text x={w - 4} y={entryY - 4} textAnchor="end" className="fill-amber-800 text-[10px]">
                Entry {formatPrice(entryPrice!)}
              </text>
            </>
          )}

          <path d={area} fill="url(#stock-area-fill)" />
          <path d={d} fill="none" stroke="oklch(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

          {ltpY != null && !hover && (
            <circle cx={w - 2} cy={ltpY} r={4} fill="oklch(var(--primary))" stroke="white" strokeWidth={1.5} />
          )}

          {hover && (
            <>
              <line
                x1={hover.svgX}
                y1={padTop}
                x2={hover.svgX}
                y2={h - padBottom}
                stroke="oklch(var(--primary) / 0.45)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <line
                x1={0}
                y1={hover.svgY}
                x2={w}
                y2={hover.svgY}
                stroke="oklch(var(--primary) / 0.35)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <circle cx={hover.svgX} cy={hover.svgY} r={5} fill="oklch(var(--primary))" stroke="white" strokeWidth={2} />
            </>
          )}

          {tickIndexes.map((i) => (
            <text
              key={i}
              x={i * step}
              y={h - 6}
              textAnchor={i === 0 ? "start" : i === prices.length - 1 ? "end" : "middle"}
              className="fill-muted-foreground text-[10px]"
            >
              {timestamps[i] ? formatDateLabel(timestamps[i]) : `#${i + 1}`}
            </text>
          ))}

          <rect
            x={0}
            y={padTop}
            width={w}
            height={chartH}
            fill="transparent"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
        </svg>
      </div>
    </div>
  );
}
