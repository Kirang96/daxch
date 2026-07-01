import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Logo } from "@/components/daxch/logo";
import { Disclaimer } from "@/components/daxch/primitives";

type LegalPageProps = {
  title: string;
  children: React.ReactNode;
};

export function LegalPage({ title, children }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/20 bg-muted">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/">
            <Logo />
          </Link>
          <Link href="/" className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <div className="prose-daxch mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">{children}</div>
        <div className="mt-12">
          <Disclaimer />
        </div>
      </main>
    </div>
  );
}
