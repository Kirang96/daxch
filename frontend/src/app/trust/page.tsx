import { LegalPage } from "@/components/daxch/legal-page";

export const metadata = { title: "Trust & Security · Daxch" };

export default function TrustPage() {
  return (
    <LegalPage title="Trust & Security">
      <p>
        Daxch is built for Indian retail investors who want AI-assisted monitoring without giving up control of their
        trades.
      </p>
      <h2 className="text-lg font-medium text-foreground">You approve every trade</h2>
      <p>
        Daxch never places orders without your explicit approval. AI agents research and suggest actions; you review the
        evidence and decide. Only approved suggestions are sent to your broker.
      </p>
      <h2 className="text-lg font-medium text-foreground">Broker permissions</h2>
      <p>
        Upstox connection uses OAuth. Daxch stores access tokens securely to sync order fills and execute trades you
        confirm. You can disconnect at any time from Settings → Broker.
      </p>
      <h2 className="text-lg font-medium text-foreground">What Daxch is not</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>Not a SEBI-registered investment advisor</li>
        <li>Not a stock recommendation or tip service</li>
        <li>Not a live Demat portfolio sync — P/L comes from Daxch-approved exchange fills only</li>
      </ul>
      <h2 className="text-lg font-medium text-foreground">AI transparency</h2>
      <p>
        Every agent conclusion includes reasoning, risk notes, and linked context where available. Outputs are
        informational — not guaranteed to be accurate or complete.
      </p>
      <h2 className="text-lg font-medium text-foreground">Payments</h2>
      <p>
        Subscriptions are processed by Razorpay. Daxch does not store your card or UPI details.
      </p>
    </LegalPage>
  );
}
