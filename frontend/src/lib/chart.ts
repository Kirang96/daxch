export type ChartTimeframe = "1D" | "1W" | "1M" | "3M" | "1Y" | "All";

export function sliceByTimeframe(data: number[], timeframe: ChartTimeframe): number[] {
  if (data.length === 0) return [];
  switch (timeframe) {
    case "1D":
      return data.slice(-2);
    case "1W":
      return data.slice(-5);
    case "1M":
      return data.slice(-22);
    case "3M":
      return data.slice(-66);
    case "1Y":
      return data.slice(-250);
    case "All":
      return data;
    default:
      return data.slice(-22);
  }
}
