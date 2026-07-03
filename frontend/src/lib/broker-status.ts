export type BrokerConnectionStatus = {
  connected: boolean;
  expired?: boolean;
  broker?: string;
  expires_at?: string;
};

export function isBrokerHealthy(status: BrokerConnectionStatus | null | undefined): boolean {
  return Boolean(status?.connected && !status?.expired);
}
