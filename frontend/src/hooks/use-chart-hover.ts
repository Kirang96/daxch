"use client";

import { useCallback, useRef, useState } from "react";

export type ChartHoverState = {
  index: number;
  svgX: number;
  svgY: number;
  price: number;
  label: string;
} | null;

type UseChartHoverOptions = {
  prices: number[];
  timestamps?: string[];
  plotWidth: number;
  plotHeight: number;
  padTop: number;
  padBottom: number;
  min: number;
  max: number;
  formatLabel?: (ts: string, index: number) => string;
};

function defaultFormatLabel(ts: string, index: number) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts.slice(0, 10) || `#${index + 1}`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function useChartHover({
  prices,
  timestamps = [],
  plotWidth,
  plotHeight,
  padTop,
  padBottom,
  min,
  max,
  formatLabel = defaultFormatLabel,
}: UseChartHoverOptions) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<ChartHoverState>(null);

  const range = max - min || 1;
  const chartH = plotHeight - padTop - padBottom;

  const yFor = useCallback(
    (v: number) => padTop + chartH - ((v - min) / range) * chartH,
    [padTop, chartH, min, range]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGRectElement>) => {
      const svg = svgRef.current;
      if (!svg || prices.length < 2) return;

      const rect = svg.getBoundingClientRect();
      const viewBox = svg.viewBox.baseVal;
      const scaleX = viewBox.width / rect.width;
      const scaleY = viewBox.height / rect.height;

      const svgX = Math.max(0, Math.min(plotWidth, (e.clientX - rect.left) * scaleX));

      const n = prices.length;
      const index = Math.min(n - 1, Math.max(0, Math.floor((svgX / plotWidth) * n)));

      const price = prices[index];
      const label = timestamps[index] ? formatLabel(timestamps[index], index) : `#${index + 1}`;

      setHover({
        index,
        svgX,
        svgY: yFor(price),
        price,
        label,
      });
    },
    [prices, timestamps, plotWidth, yFor, formatLabel]
  );

  const handleMouseLeave = useCallback(() => setHover(null), []);

  return { svgRef, hover, handleMouseMove, handleMouseLeave, yFor };
}
