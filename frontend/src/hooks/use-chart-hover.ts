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

/** Map screen X to viewBox X accounting for preserveAspectRatio="xMidYMid meet" letterboxing. */
function clientXToViewBoxX(svg: SVGSVGElement, clientX: number, plotWidth: number): number {
  const rect = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const vbW = vb.width || plotWidth;
  const vbH = vb.height || 1;

  const scale = Math.min(rect.width / vbW, rect.height / vbH);
  const renderedW = vbW * scale;
  const offsetX = (rect.width - renderedW) / 2;

  const localX = clientX - rect.left - offsetX;
  const svgX = localX / scale;

  return Math.max(0, Math.min(plotWidth, svgX));
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

      const svgX = clientXToViewBoxX(svg, e.clientX, plotWidth);

      const n = prices.length;
      const step = plotWidth / (n - 1);
      const index = Math.min(n - 1, Math.max(0, Math.round(svgX / step)));
      const snappedX = index * step;

      const price = prices[index];
      const label = timestamps[index] ? formatLabel(timestamps[index], index) : `#${index + 1}`;

      setHover({
        index,
        svgX: snappedX,
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
