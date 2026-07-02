export function formatQuoteSearchError(message: string, ticker: string, exchange: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("connect upstox") ||
    lower.includes("reconnect") ||
    lower.includes("broker session") ||
    lower.includes("market data access")
  ) {
    return "Connect or reconnect Upstox in Settings → Broker before searching live quotes.";
  }
  if (
    lower.includes("not found") ||
    lower.includes("404") ||
    lower.includes("unknown") ||
    lower.includes("invalid") ||
    lower.includes("no quote") ||
    lower.includes("unable to find instrument")
  ) {
    return `Could not find "${ticker}" on ${exchange}. Check the symbol and try again.`;
  }
  if (lower.includes("unexpected server error")) {
    return "Live quote lookup failed. Reconnect Upstox and try again.";
  }
  return message || `Could not load a live quote for "${ticker}" on ${exchange}.`;
}
