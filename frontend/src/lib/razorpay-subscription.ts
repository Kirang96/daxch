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

  return new Promise((resolve) => {
    const rzp = new Razorpay({
      key: options.keyId,
      subscription_id: options.subscriptionId,
      name: "Daxch",
      description: `${options.planName} plan`,
      handler: async () => {
        await options.onSuccess?.();
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
  if (response.checkout_url) {
    setStatus("Redirecting to Razorpay checkout...");
    window.location.href = response.checkout_url;
    return;
  }

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

  setStatus(`Subscription created (${response.status}). Waiting for payment confirmation...`);
  await onRefresh();
}
