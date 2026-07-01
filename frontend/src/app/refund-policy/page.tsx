import Link from "next/link";

import { LegalPage } from "@/components/daxch/legal-page";

export const metadata = { title: "Refund Policy · Daxch" };

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund Policy">
      <p>Last updated: July 2026</p>
      <p>
        This Refund Policy applies to payments made to <strong className="text-foreground">Daxch</strong> (
        <Link href="https://daxch.app" className="text-foreground underline-offset-4 hover:underline">
          https://daxch.app
        </Link>
        ), operated from India. Payments are processed by Razorpay Payment Solutions Pvt. Ltd. Daxch is the merchant
        of record for subscriptions and digital services sold on this website.
      </p>

      <h2 className="text-lg font-medium text-foreground">1. Nature of service</h2>
      <p>
        Daxch is a digital software service (SaaS). We provide AI-assisted stock monitoring, research tools, and related
        features. There is no physical shipping. Access is delivered electronically to your account after successful
        payment.
      </p>

      <h2 className="text-lg font-medium text-foreground">2. Subscription plans and pricing</h2>
      <p>Monthly subscription plans (prices inclusive of applicable taxes unless stated otherwise at checkout):</p>
      <ul className="list-disc space-y-2 pl-5">
        <li>Starter — ₹499 per month</li>
        <li>Pro — ₹999 per month</li>
        <li>Ultra — ₹2,499 per month</li>
      </ul>
      <p>
        Optional one-time <strong className="text-foreground">AI Units top-up</strong> purchases may also be offered.
        Top-ups are consumed as digital credits inside the product.
      </p>

      <h2 className="text-lg font-medium text-foreground">3. General refund rule</h2>
      <p>
        Subscription fees are <strong className="text-foreground">non-refundable</strong> once the billing period has
        started and service access (including monthly AI Units allocation) has been provisioned, except where required
        by law or as described in Section 4 below.
      </p>
      <p>
        Cancelling a subscription stops future renewals but does not automatically refund the current billing period.
        See our{" "}
        <Link href="/cancellation-policy" className="text-foreground underline-offset-4 hover:underline">
          Cancellation Policy
        </Link>
        .
      </p>

      <h2 className="text-lg font-medium text-foreground">4. When we may issue a refund</h2>
      <p>We may approve a full or partial refund at our discretion if:</p>
      <ul className="list-disc space-y-2 pl-5">
        <li>You were charged more than once for the same subscription cycle due to a technical error.</li>
        <li>Payment succeeded but your subscription or purchased AI Units were not provisioned within a reasonable time.</li>
        <li>Daxch is unable to provide the subscribed service for a material period during your paid billing cycle.</li>
        <li>A Razorpay mandate authorisation charge (e.g. ₹5 token validation for cards/UPI) was collected — such amounts
          are auto-refunded by Razorpay per their process; no action is required from you.</li>
      </ul>
      <p>
        Refunds are <strong className="text-foreground">not</strong> provided for dissatisfaction with AI output,
        trading losses, unused AI Units within a billing period, or failure to use the product during an active
        subscription.
      </p>

      <h2 className="text-lg font-medium text-foreground">5. AI Units top-ups</h2>
      <p>
        AI Units top-up purchases are non-refundable once credits have been added to your account, except in cases of
        duplicate charge or failed provisioning (Section 4).
      </p>

      <h2 className="text-lg font-medium text-foreground">6. How to request a refund</h2>
      <p>
        Email{" "}
        <a href="mailto:support@daxch.app" className="text-foreground underline-offset-4 hover:underline">
          support@daxch.app
        </a>{" "}
        within <strong className="text-foreground">7 days</strong> of the charge with:
      </p>
      <ul className="list-disc space-y-2 pl-5">
        <li>Your Daxch account email</li>
        <li>Date and amount of payment</li>
        <li>Razorpay payment ID or subscription ID (from email receipt or Razorpay confirmation)</li>
        <li>Brief reason for the request</li>
      </ul>
      <p>We aim to respond within 3 business days.</p>

      <h2 className="text-lg font-medium text-foreground">7. Refund processing time</h2>
      <p>
        Approved refunds are initiated to your original payment method (card, UPI, or netbanking) via Razorpay. Per
        Razorpay and banking partner timelines, refunds typically reflect in{" "}
        <strong className="text-foreground">5–10 business days</strong> after initiation. Your bank or card issuer may
        take additional time. See{" "}
        <a
          href="https://razorpay.com/docs/payments/refunds/normal/"
          className="text-foreground underline-offset-4 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Razorpay refund documentation
        </a>
        .
      </p>

      <h2 className="text-lg font-medium text-foreground">8. Chargebacks and disputes</h2>
      <p>
        If you believe a charge is unauthorised, contact us first at{" "}
        <a href="mailto:support@daxch.app" className="text-foreground underline-offset-4 hover:underline">
          support@daxch.app
        </a>{" "}
        so we can investigate. Razorpay facilitates payments but does not issue refunds on behalf of merchants — only
        Daxch can approve and initiate refunds for Daxch purchases.
      </p>

      <h2 className="text-lg font-medium text-foreground">9. Contact</h2>
      <p>
        <strong className="text-foreground">Daxch</strong>
        <br />
        Website:{" "}
        <Link href="https://daxch.app" className="text-foreground underline-offset-4 hover:underline">
          https://daxch.app
        </Link>
        <br />
        Email:{" "}
        <a href="mailto:support@daxch.app" className="text-foreground underline-offset-4 hover:underline">
          support@daxch.app
        </a>
      </p>
    </LegalPage>
  );
}
