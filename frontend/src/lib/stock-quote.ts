export function formatQuoteSearchError(message: string, ticker: string, exchange: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("not found") ||
    lower.includes("404") ||
    lower.includes("unknown") ||
    lower.includes("invalid") ||
    lower.includes("no quote")
  ) {
    return `Could not find "${ticker}" on ${exchange}. Check the symbol and try again.`;
  }
  return message || `Could not load a live quote for "${ticker}" on ${exchange}.`;
}
