import { LegalPage } from "@/components/daxch/legal-page";

export const metadata = { title: "Terms of Service · Daxch" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>Last updated: June 2026</p>
      <p>
        By using Daxch, you agree to these terms. Daxch provides AI-assisted stock monitoring and research tools. We do
        not provide investment advice or stock recommendations.
      </p>
      <h2 className="text-lg font-medium text-foreground">Your responsibilities</h2>
      <p>
        You are solely responsible for all investment and trading decisions. You must approve any trade before Daxch
        sends orders to your connected broker. You must provide accurate planned entry and quantity when creating agents.
      </p>
      <h2 className="text-lg font-medium text-foreground">Subscriptions</h2>
      <p>
        Access requires an active paid subscription billed monthly via Razorpay. You may cancel by contacting
        support; access continues until the end of the billing period.
      </p>
      <h2 className="text-lg font-medium text-foreground">Broker integration</h2>
      <p>
        Connecting a broker authorizes Daxch to sync order status and place trades you explicitly approve. You may revoke
        broker access at any time from Settings.
      </p>
      <h2 className="text-lg font-medium text-foreground">Limitation of liability</h2>
      <p>
        Daxch is provided &quot;as is.&quot; We are not liable for trading losses, missed alerts, or AI output accuracy.
        Daxch is not a SEBI-registered investment advisor.
      </p>
    </LegalPage>
  );
}
