"use client";

import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderPulse = {
  id: number;
  x: number;
  y: number;
  side: "BUY" | "SELL";
  born: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const W = 300;
const H = 60;
const SEED_PRICES = [1610, 1618, 1624, 1615, 1628, 1635, 1630, 1642, 1638, 1648, 1642];
const TOTAL_POINTS = 28;
const TICK_MS = 600;
const ORDER_INTERVAL_TICKS = 4;

function priceToY(price: number, min: number, max: number): number {
  const pad = 6;
  return H - pad - ((price - min) / (max - min)) * (H - pad * 2);
}

function pathFromPoints(points: number[], minP: number, maxP: number): string {
  return points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * W;
      const y = priceToY(p, minP, maxP);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function areaFromPoints(points: number[], minP: number, maxP: number): string {
  const line = pathFromPoints(points, minP, maxP);
  const lastX = W;
  const lastY = priceToY(points[points.length - 1], minP, maxP);
  return `${line} L${lastX} ${H} L0 ${H} Z`;
}

function randomDelta(): number {
  return (Math.random() - 0.46) * 10;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AgentLiveCard() {
  const [prices, setPrices] = useState<number[]>(SEED_PRICES);
  const [orderPulses, setOrderPulses] = useState<OrderPulse[]>([]);
  const tickRef = useRef(0);
  const orderIdRef = useRef(0);

  // Tick: advance price & occasionally fire an order pulse
  useEffect(() => {
    const interval = setInterval(() => {
      tickRef.current += 1;
      const tick = tickRef.current;

      setPrices((prev) => {
        const next = [...prev, prev[prev.length - 1] + randomDelta()];
        return next.length > TOTAL_POINTS ? next.slice(next.length - TOTAL_POINTS) : next;
      });

      if (tick % ORDER_INTERVAL_TICKS === 0) {
        // Decide side based on recent trend
        setPrices((prev) => {
          const trend = prev[prev.length - 1] - prev[Math.max(0, prev.length - 5)];
          const side: "BUY" | "SELL" = trend > 0 ? "BUY" : "SELL";
          const minP = Math.min(...prev);
          const maxP = Math.max(...prev);
          const xFrac = 0.75 + Math.random() * 0.2;
          const px = prev[Math.floor(xFrac * (prev.length - 1))] || prev[prev.length - 1];
          const x = xFrac * W;
          const y = priceToY(px, minP, maxP);

          setOrderPulses((pulses) => [
            ...pulses.slice(-6),
            { id: orderIdRef.current++, x, y, side, born: Date.now() },
          ]);
          return prev;
        });
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  }, []);

  // Reap old pulses
  useEffect(() => {
    const reaper = setInterval(() => {
      const now = Date.now();
      setOrderPulses((p) => p.filter((o) => now - o.born < 3200));
    }, 500);
    return () => clearInterval(reaper);
  }, []);

  const minP = Math.min(...prices);
  const maxP = Math.max(...prices) || minP + 1;
  const currentPrice = prices[prices.length - 1];
  const openPrice = prices[0];
  const changePct = (((currentPrice - openPrice) / openPrice) * 100).toFixed(2);
  const isUp = currentPrice >= openPrice;

  const linePath = pathFromPoints(prices, minP, maxP);
  const areaPath = areaFromPoints(prices, minP, maxP);
  const headX = W;
  const headY = priceToY(currentPrice, minP, maxP);

  return (
    <div className="border border-border/15 bg-muted shadow-editorial">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-border/15 p-6 pb-4">
        <div>
          <div className="editorial-label mb-1 flex items-center gap-1.5 text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Agent Active
          </div>
          <h3 className="font-mono text-xl font-medium">HDFCBANK.NSE</h3>
        </div>
        <div className="text-right">
          <div
            className="font-mono text-lg tabular-nums transition-colors duration-300"
            key={Math.round(currentPrice)}
          >
            ₹{currentPrice.toFixed(2)}
          </div>
          <div
            className={`font-mono text-xs tabular-nums ${isUp ? "text-emerald-700" : "text-red-600"}`}
          >
            {isUp ? "+" : ""}
            {changePct}%
          </div>
        </div>
      </div>

      {/* Animated chart */}
      <div className="relative px-6 pb-2 pt-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-16 w-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(var(--primary))" stopOpacity="0.18" />
              <stop offset="100%" stopColor="oklch(var(--primary))" stopOpacity="0" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Area fill */}
          <path d={areaPath} fill="url(#chartGrad)" />

          {/* Price line */}
          <path
            d={linePath}
            fill="none"
            stroke="oklch(var(--primary))"
            strokeWidth="1.6"
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#glow)"
          />

          {/* Live head dot */}
          <circle cx={headX} cy={headY} r="3" fill="oklch(var(--primary))" />
          <circle
            cx={headX}
            cy={headY}
            r="6"
            fill="oklch(var(--primary))"
            fillOpacity="0.25"
            className="animate-ping"
            style={{ transformOrigin: `${headX}px ${headY}px` }}
          />

          {/* Order pulses */}
          {orderPulses.map((o) => {
            const age = (Date.now() - o.born) / 3200;
            const opacity = Math.max(0, 1 - age);
            const isBuy = o.side === "BUY";
            const color = isBuy ? "#059669" : "#dc2626";
            const markerY = isBuy ? o.y - 11 : o.y + 11;

            return (
              <g key={o.id} style={{ opacity }}>
                {/* Expanding ring */}
                <circle
                  cx={o.x}
                  cy={o.y}
                  r={6 + age * 14}
                  fill="none"
                  stroke={color}
                  strokeWidth="1"
                  strokeOpacity={0.6 * (1 - age)}
                />
                {/* Second ring offset */}
                <circle
                  cx={o.x}
                  cy={o.y}
                  r={3 + age * 8}
                  fill="none"
                  stroke={color}
                  strokeWidth="0.8"
                  strokeOpacity={0.4 * (1 - age)}
                />
                {/* Dot on line */}
                <circle cx={o.x} cy={o.y} r="3" fill={color} />
                {/* Label */}
                <rect
                  x={o.x - 13}
                  y={markerY - 7}
                  width="26"
                  height="12"
                  rx="2"
                  fill={color}
                  fillOpacity="0.9"
                />
                <text
                  x={o.x}
                  y={markerY + 3.5}
                  textAnchor="middle"
                  fontSize="7"
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill="white"
                >
                  {o.side}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Analysis signals */}
      <div className="space-y-4 px-6 pb-6">
        <div className="flex gap-3">
          <div className="w-0.5 shrink-0 self-stretch bg-primary" />
          <div className="text-sm">
            <p className="editorial-label mb-1 text-muted-foreground">Technical Signal</p>
            <p className="leading-snug">Price consolidated above 200-DMA with rising volume profile.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="w-0.5 shrink-0 self-stretch bg-primary/40" />
          <div className="text-sm">
            <p className="editorial-label mb-1 text-muted-foreground">Earnings Intelligence</p>
            <p className="leading-snug italic">
              &ldquo;Management signaled NIM expansion in Q3 transcript analysis.&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border/15 px-6 py-4">
        <span className="editorial-label text-muted-foreground">Updated 2m ago</span>
        <span className="editorial-label text-muted-foreground">Upstox Integrated</span>
      </div>
    </div>
  );
}
