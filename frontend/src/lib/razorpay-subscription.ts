import { api } from "@/lib/api";
import { Subscription } from "@/types";

type RazorpayInstance = { open: () => void };

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

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

export async function syncSubscriptionStatus(): Promise<Subscription> {
  return api.post<Subscription>("/subscriptions/sync");
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
}): Promise<boolean> {
  const Razorpay = await loadRazorpayScript();
  if (!Razorpay) {
    return false;
  }

  const callbackUrl = checkoutCallbackUrl();

  return new Promise((resolve) => {
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
        ondismiss: () => resolve(false)
      }
    });
    rzp.open();
  });
}

export async function startSubscriptionCheckout(
  response: Subscription,
  plan: string,
  onRefresh: () => Promise<void>,
  setStatus: (message: string) => void
): Promise<void> {
  if (response.provider_subscription_id && response.key_id) {
    setStatus("Opening Razorpay checkout...");
    const opened = await openSubscriptionCheckout({
      keyId: response.key_id,
      subscriptionId: response.provider_subscription_id,
      planName: plan,
      onSuccess: async () => {
        setStatus("Payment received. Activating subscription...");
        await onRefresh();
      }
    });
    if (!opened) {
      setStatus("Payment gateway unavailable. Try again later.");
    }
    return;
  }

  if (response.checkout_url) {
    setStatus("Opening Razorpay checkout. Return to Daxch after payment.");
    window.location.href = response.checkout_url;
    return;
  }

  setStatus(`Subscription created (${response.status}). Waiting for payment confirmation...`);
  await onRefresh();
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
