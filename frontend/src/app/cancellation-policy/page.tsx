import Link from "next/link";

import { LegalPage } from "@/components/daxch/legal-page";

export const metadata = { title: "Cancellation Policy · Daxch" };

export default function CancellationPolicyPage() {
  return (
    <LegalPage title="Cancellation Policy">
      <p>Last updated: July 2026</p>
      <p>
        This Cancellation Policy explains how to cancel your <strong className="text-foreground">Daxch</strong>{" "}
        subscription billed through Razorpay at{" "}
        <Link href="https://daxch.app" className="text-foreground underline-offset-4 hover:underline">
          https://daxch.app
        </Link>
        . For refunds after cancellation, see our{" "}
        <Link href="/refund-policy" className="text-foreground underline-offset-4 hover:underline">
          Refund Policy
        </Link>
        .
      </p>

      <h2 className="text-lg font-medium text-foreground">1. Subscription model</h2>
      <p>
        Daxch subscriptions are billed <strong className="text-foreground">monthly</strong> on a recurring basis until
        cancelled. Plans: Starter (₹499/month), Pro (₹999/month), Ultra (₹2,499/month). By subscribing, you authorise
        Razorpay to charge your selected payment method (card, UPI Autopay, or eMandate/netbanking, as available) each
        billing cycle.
      </p>

      <h2 className="text-lg font-medium text-foreground">2. How to cancel</h2>
      <p>You may cancel future renewals using any of the following methods:</p>

      <h3 className="text-base font-medium text-foreground">A. Email (all payment methods)</h3>
      <p>
        Send a cancellation request from your registered email to{" "}
        <a href="mailto:support@daxch.app" className="text-foreground underline-offset-4 hover:underline">
          support@daxch.app
        </a>{" "}
        with the subject line <em>Subscription cancellation</em>. Include your account email and plan name. We will
        cancel the subscription in Razorpay within 2 business days and confirm by email.
      </p>

      <h3 className="text-base font-medium text-foreground">B. UPI Autopay subscriptions</h3>
      <p>
        If you subscribed using UPI Autopay, you may also cancel the mandate directly in your UPI app (Google Pay,
        PhonePe, Paytm, or your bank&apos;s UPI app) under <em>Autopay</em> / <em>Subscriptions</em> /{" "}
        <em>Mandates</em>. Cancelling the mandate stops future charges. See{" "}
        <a
          href="https://razorpay.com/docs/payments/subscriptions/faqs/"
          className="text-foreground underline-offset-4 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Razorpay Subscriptions FAQs
        </a>
        .
      </p>

      <h3 className="text-base font-medium text-foreground">C. Card and eMandate (netbanking)</h3>
      <p>
        For card or eMandate subscriptions, contact{" "}
        <a href="mailto:support@daxch.app" className="text-foreground underline-offset-4 hover:underline">
          support@daxch.app
        </a>{" "}
        to cancel. eMandate mandates may also be revocable through your bank per bank policy.
      </p>

      <h2 className="text-lg font-medium text-foreground">3. Effect of cancellation</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong className="text-foreground">Future billing:</strong> No further charges after cancellation is
          processed.
        </li>
        <li>
          <strong className="text-foreground">Current period:</strong> You retain access to paid features until the end
          of the billing period already paid for, unless we state otherwise.
        </li>
        <li>
          <strong className="text-foreground">Downgrade:</strong> After the period ends, your account may revert to
          limited access until you subscribe again.
        </li>
        <li>
          <strong className="text-foreground">AI Units:</strong> Unused monthly AI Units do not roll over and are not
          refunded on cancellation (see Refund Policy).
        </li>
      </ul>

      <h2 className="text-lg font-medium text-foreground">4. Plan changes</h2>
      <p>
        To upgrade or downgrade, subscribe to a different plan from{" "}
        <Link href="/subscription" className="text-foreground underline-offset-4 hover:underline">
          Subscription
        </Link>{" "}
        in the app, or email support@daxch.app. Plan changes may take effect on the next billing cycle depending on
        Razorpay subscription behaviour.
      </p>

      <h2 className="text-lg font-medium text-foreground">5. Failed or paused payments</h2>
      <p>
        If a recurring charge fails, Razorpay may retry per their rules. Your subscription may move to a paused or
        inactive state until payment succeeds. We may restrict paid features until the subscription is active again.
      </p>

      <h2 className="text-lg font-medium text-foreground">6. Account deletion</h2>
      <p>
        Cancelling your subscription does not automatically delete your Daxch account or broker connection. To delete
        account data, contact{" "}
        <a href="mailto:support@daxch.app" className="text-foreground underline-offset-4 hover:underline">
          support@daxch.app
        </a>{" "}
        after cancelling any active subscription to avoid further charges.
      </p>

      <h2 className="text-lg font-medium text-foreground">7. Merchant of record</h2>
      <p>
        Daxch is responsible for subscription fulfilment and cancellation requests. Razorpay is the payment gateway only
        and does not cancel subscriptions on our behalf — please contact Daxch or use your UPI app as described above.
      </p>

      <h2 className="text-lg font-medium text-foreground">8. Contact</h2>
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
