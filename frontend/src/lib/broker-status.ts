export type BrokerConnectionStatus = {
  connected: boolean;
  expired?: boolean;
  broker?: string;
  expires_at?: string;
};

export function isBrokerHealthy(status: BrokerConnectionStatus | null | undefined): boolean {
  return Boolean(status?.connected && !status?.expired);
}

export function formatBrokerName(brokerId: string | undefined): string {
  if (!brokerId) return "Broker";
  const labels: Record<string, string> = {
    upstox: "Upstox",
    "5paisa": "5paisa",
    zerodha: "Zerodha",
    angelone: "Angel One",
    groww: "Groww",
  };
  return labels[brokerId.toLowerCase()] || brokerId;
}
