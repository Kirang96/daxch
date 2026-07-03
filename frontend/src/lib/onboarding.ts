import { api } from "@/lib/api";
import { BrokerConnectionStatus, isBrokerHealthy } from "@/lib/broker-status";
import { MonitorAgent } from "@/types";

const WELCOME_KEY = "daxch_onboarding_welcome";

export function markWelcomeComplete(): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(WELCOME_KEY, "1");
  }
}

export function isWelcomeComplete(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(WELCOME_KEY) === "1";
}

export async function resolvePostAuthPath(): Promise<string> {
  try {
    const agents = await api.get<MonitorAgent[]>("/agents");
    if (agents.length > 0) {
      return "/dashboard";
    }
    if (!isWelcomeComplete()) {
      return "/onboarding/welcome";
    }
    try {
      const broker = await api.get<BrokerConnectionStatus>("/broker/connection-status");
      if (!isBrokerHealthy(broker)) {
        return "/onboarding/broker";
      }
    } catch {
      return "/onboarding/broker";
    }
    return "/dashboard";
  } catch {
    return "/onboarding/welcome";
  }
}
