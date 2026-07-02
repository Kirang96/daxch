/** OAuth `state` passed to Upstox and echoed on /broker/callback. */
export const BROKER_OAUTH_STATE = {
  ONBOARDING: "onboarding",
  APP: "app"
} as const;

export type BrokerOAuthState = (typeof BROKER_OAUTH_STATE)[keyof typeof BROKER_OAUTH_STATE];

export function resolveBrokerOAuthReturnPath(state: string | null | undefined): string {
  if (state === BROKER_OAUTH_STATE.ONBOARDING) {
    return "/onboarding/subscription?broker=connected";
  }
  return "/broker?broker=connected";
}
