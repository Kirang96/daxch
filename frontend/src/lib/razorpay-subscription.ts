import { api } from "@/lib/api";
import { Subscription } from "@/types";

type RazorpayInstance = { open: () => void };

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

export type CheckoutStartResult = "started" | "failed";

function getRazorpay(): RazorpayConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }
  return (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay ?? null;
}

function loadRazorpayScript(): Promise<RazorpayConstructor | null> {
  const existing = getRazorpay();
  if (existing) {
    return Promise.resolve(existing);
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(getRazorpay());
    script.onerror = () => resolve(null);
    document.body.appendChild(script);
  });
}

function checkoutCallbackUrl(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return `${window.location.origin}/api/v1/subscriptions/checkout-callback`;
}

function redirectToCheckout(checkoutUrl: string, setStatus: (message: string) => void): CheckoutStartResult {
  setStatus("Opening Razorpay checkout. Return to Daxch after payment.");
  window.location.href = checkoutUrl;
  return "started";
}

export async function syncSubscriptionStatus(): Promise<Subscription> {
  return api.post<Subscription>("/subscriptions/sync", {});
}

export async function finalizeSubscriptionReturn(
  refresh: () => Promise<void>,
  setStatus: (message: string) => void
): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("payment") !== "success") {
    return;
  }

  setStatus("Confirming your subscription...");
  try {
    await syncSubscriptionStatus();
    await refresh();
    setStatus("Subscription active. You're all set!");
    window.history.replaceState({}, "", window.location.pathname);
  } catch (error) {
    setStatus((error as Error).message);
  }
}

export async function openSubscriptionCheckout(options: {
  keyId: string;
  subscriptionId: string;
  planName: string;
  onSuccess?: () => void | Promise<void>;
  onDismiss?: () => void;
}): Promise<boolean> {
  const Razorpay = await loadRazorpayScript();
  if (!Razorpay) {
    return false;
  }

  const callbackUrl = checkoutCallbackUrl();

  return new Promise((resolve) => {
    try {
      const rzp = new Razorpay({
        key: options.keyId,
        subscription_id: options.subscriptionId,
        name: "Daxch",
        description: `${options.planName} plan`,
        callback_url: callbackUrl,
        redirect: true,
        handler: async () => {
          await options.onSuccess?.();
          window.location.href = "/subscription?payment=success";
          resolve(true);
        },
        modal: {
          ondismiss: () => {
            options.onDismiss?.();
            resolve(false);
          },
        },
      });
      rzp.open();
    } catch {
      options.onDismiss?.();
      resolve(false);
    }
  });
}

export async function startSubscriptionCheckout(
  response: Subscription,
  plan: string,
  onRefresh: () => Promise<void>,
  setStatus: (message: string) => void,
  onCheckoutEnd?: () => void
): Promise<CheckoutStartResult> {
  const checkoutUrl = response.checkout_url;
  const hasModalPayload = Boolean(response.provider_subscription_id && response.key_id);

  if (!hasModalPayload && !checkoutUrl) {
    setStatus(
      "Payment could not be started: Razorpay returned no checkout URL or subscription ID. Check staging payment secrets."
    );
    onCheckoutEnd?.();
    return "failed";
  }

  if (hasModalPayload) {
    setStatus("Opening Razorpay checkout...");
    try {
      const opened = await openSubscriptionCheckout({
        keyId: response.key_id!,
        subscriptionId: response.provider_subscription_id!,
        planName: plan,
        onSuccess: async () => {
          setStatus("Payment received. Activating subscription...");
          await onRefresh();
        },
        onDismiss: onCheckoutEnd,
      });
      if (opened) {
        return "started";
      }
      if (checkoutUrl) {
        return redirectToCheckout(checkoutUrl, setStatus);
      }
      setStatus("Payment window closed before checkout opened. Try again.");
      onCheckoutEnd?.();
      return "failed";
    } catch (error) {
      if (checkoutUrl) {
        return redirectToCheckout(checkoutUrl, setStatus);
      }
      setStatus((error as Error).message || "Could not open payment checkout.");
      onCheckoutEnd?.();
      return "failed";
    }
  }

  if (checkoutUrl) {
    return redirectToCheckout(checkoutUrl, setStatus);
  }

  setStatus(`Subscription created (${response.status}). Waiting for payment confirmation...`);
  await onRefresh();
  onCheckoutEnd?.();
  return "failed";
}

export async function refreshPendingSubscription(
  current: Subscription | null,
  refresh: () => Promise<void>
): Promise<void> {
  if (!current?.provider_subscription_id || current.status === "active") {
    return;
  }
  try {
    await syncSubscriptionStatus();
    await refresh();
  } catch {
    // Ignore sync errors on background refresh.
  }
}
