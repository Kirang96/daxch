import { LegalPage } from "@/components/daxch/legal-page";

export const metadata = { title: "Privacy Policy · Daxch" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>Last updated: June 2026</p>
      <p>
        Daxch respects your privacy. This policy describes what data we collect and how we use it when you use our
        platform.
      </p>
      <h2 className="text-lg font-medium text-foreground">Data we collect</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>Account information: email, name, and authentication tokens</li>
        <li>Planned trades: tickers, quantities, and entry prices you enter for AI analysis</li>
        <li>Broker OAuth tokens (encrypted) to sync orders and execute approved trades</li>
        <li>Usage data: agent activity, notifications, and audit logs</li>
      </ul>
      <h2 className="text-lg font-medium text-foreground">How we use data</h2>
      <p>
        We use your data to run AI monitoring agents, send alerts you configure, process subscriptions, and improve the
        product. We do not sell your personal data.
      </p>
      <h2 className="text-lg font-medium text-foreground">Third parties</h2>
      <p>
        We use Upstox (broker), Razorpay (payments), Google (optional sign-in), and cloud providers for hosting. Each
        receives only the data needed to provide their service.
      </p>
      <h2 className="text-lg font-medium text-foreground">Your rights</h2>
      <p>
        You may request access to or deletion of your data by contacting support. Account deletion will be available in
        Settings once fully implemented.
      </p>
    </LegalPage>
  );
}
