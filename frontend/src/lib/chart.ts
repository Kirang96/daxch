export type ChartTimeframe = "1D" | "1W" | "1M" | "3M" | "1Y" | "All";

export const DEFAULT_CHART_TIMEFRAME: ChartTimeframe = "1Y";

function sliceCount(timeframe: ChartTimeframe): number | null {
  switch (timeframe) {
    case "1D":
      return 2;
    case "1W":
      return 5;
    case "1M":
      return 22;
    case "3M":
      return 66;
    case "1Y":
      return 250;
    case "All":
      return null;
    default:
      return 22;
  }
}

export function sliceByTimeframe(data: number[], timeframe: ChartTimeframe): number[] {
  if (data.length === 0) return [];
  const count = sliceCount(timeframe);
  return count == null ? data : data.slice(-count);
}

export function sliceSeriesByTimeframe(
  prices: number[],
  timestamps: string[],
  timeframe: ChartTimeframe
): { prices: number[]; timestamps: string[] } {
  if (prices.length === 0) return { prices: [], timestamps: [] };
  const count = sliceCount(timeframe);
  if (count == null) {
    return { prices, timestamps: timestamps.slice(-prices.length) };
  }
  return {
    prices: prices.slice(-count),
    timestamps: timestamps.slice(-count),
  };
}
