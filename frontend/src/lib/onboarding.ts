import { api } from "@/lib/api";
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
      const broker = await api.get<{ connected: boolean }>("/broker/connection-status");
      if (!broker.connected) {
        return "/onboarding/broker";
      }
    } catch {
      return "/onboarding/broker";
    }
    try {
      const subscription = await api.get<{ status?: string } | null>("/subscriptions/current");
      if (!subscription || subscription.status !== "active") {
        return "/onboarding/subscription";
      }
    } catch {
      return "/onboarding/subscription";
    }
    return "/dashboard";
  } catch {
    return "/onboarding/welcome";
  }
}
