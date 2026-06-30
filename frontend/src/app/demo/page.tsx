import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Disclaimer } from "@/components/daxch/primitives";
import { Logo } from "@/components/daxch/logo";
import { DemoYouTube } from "@/components/landing/demo-youtube";

const steps = [
  { n: "1", title: "Pick your stock", desc: "Set your planned entry and investment goal." },
  { n: "2", title: "AI monitors on schedule", desc: "Fundamentals, technicals, news — analyzed automatically." },
  { n: "3", title: "Review suggestions", desc: "See evidence-backed conclusions with risk notes." },
  { n: "4", title: "Approve trades", desc: "Only confirmed orders go to your Upstox account." }
];

export const metadata = {
  title: "Product demo · Daxch",
  description: "Watch how Daxch monitors your stocks and sends trades only after you approve."
};

export default function DemoPage() {
  const youtubeId = process.env.NEXT_PUBLIC_DEMO_YOUTUBE_ID;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/12">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/">
            <Logo />
          </Link>
          <Link href="/signup" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">See how Daxch works</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          A quick walkthrough of the agent workflow — from monitoring to approved exchange trades.
        </p>

        <div className="glass mt-10 overflow-hidden rounded-2xl border border-border/15">
          <DemoYouTube videoIdOrUrl={youtubeId} />
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div key={step.n} className="flex gap-4">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {step.n}
              </div>
              <div>
                <h3 className="font-medium">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Link
            href="/signup?plan=starter"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:brightness-110"
          >
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-12">
          <Disclaimer />
        </div>
      </main>
    </div>
  );
}
