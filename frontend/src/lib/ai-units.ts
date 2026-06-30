export function formatAiUnits(value: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.max(0, Math.round(value)));
}

export function formatPercentUsed(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}
