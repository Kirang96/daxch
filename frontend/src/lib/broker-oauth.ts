/** OAuth `state` passed to brokers and echoed on /broker/callback. */
export const BROKER_OAUTH_STATE = {
  ONBOARDING: "onboarding",
  APP: "app",
} as const;

export type BrokerOAuthState = (typeof BROKER_OAUTH_STATE)[keyof typeof BROKER_OAUTH_STATE];

export function encodeBrokerOAuthState(brokerId: string, flow: BrokerOAuthState): string {
  return `${brokerId}:${flow}`;
}

export function parseBrokerOAuthState(state: string | null | undefined): {
  brokerId: string;
  flow: BrokerOAuthState;
} {
  if (state?.includes(":")) {
    const [brokerId, flow] = state.split(":", 2);
    if (flow === BROKER_OAUTH_STATE.ONBOARDING || flow === BROKER_OAUTH_STATE.APP) {
      return { brokerId: brokerId || "upstox", flow };
    }
  }
  const flow =
    state === BROKER_OAUTH_STATE.ONBOARDING ? BROKER_OAUTH_STATE.ONBOARDING : BROKER_OAUTH_STATE.APP;
  return { brokerId: "upstox", flow };
}

export function resolveBrokerOAuthReturnPath(state: string | null | undefined): string {
  const { flow } = parseBrokerOAuthState(state);
  if (flow === BROKER_OAUTH_STATE.ONBOARDING) {
    return "/onboarding/subscription?broker=connected";
  }
  return "/broker?broker=connected";
}

export type BrokerAuthUrlResponse = {
  url: string;
  method?: "GET" | "POST";
  fields?: Record<string, string>;
  redirect_uri?: string;
};

export function submitBrokerOAuthForm({
  url,
  fields,
}: {
  url: string;
  fields: Record<string, string>;
}): void {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = url;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export function startBrokerOAuth(response: BrokerAuthUrlResponse): void {
  if (response.method === "POST" && response.fields && Object.keys(response.fields).length > 0) {
    submitBrokerOAuthForm({ url: response.url, fields: response.fields });
    return;
  }
  window.location.href = response.url;
}
