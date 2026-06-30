export function clampPollingFrequency(value: number): number {
  const n = Math.round(Number(value));
  if (Number.isNaN(n)) return 2;
  return Math.max(2, Math.min(12, n));
}

export function maxPollingForPlan(plan: string | undefined): number {
  return plan?.toLowerCase() === "pro" ? 12 : 2;
}

export function describePollingFrequency(freq: number): string {
  const f = clampPollingFrequency(freq);
  if (f === 2) return "Twice daily (market open & close)";
  if (f <= 4) return `${f} checks per trading day`;
  if (f <= 8) return `~Hourly during market hours (${f}/day)`;
  return `~Every 30 minutes (${f}/day)`;
}

export function canAdoptFrequency(freq: number, maxAdoptable: number): boolean {
  return clampPollingFrequency(freq) <= clampPollingFrequency(maxAdoptable);
}
