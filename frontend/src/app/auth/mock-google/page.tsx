"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Sparkles } from "lucide-react";

import { GlassCard } from "@/components/daxch/primitives";
import { Logo } from "@/components/daxch/logo";

const SUGGESTED_ACCOUNTS = [
  { email: "kiran@daxch.com", name: "Kiran" },
  { email: "demo_trader@daxch.com", name: "Demo Trader" },
  { email: "investor@daxch.com", name: "Premium Investor" }
];

export default function MockGoogleLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (selectedEmail: string) => {
    if (!selectedEmail || !selectedEmail.includes("@")) {
      setError("Please select or enter a valid email address.");
      return;
    }
    setError("");
    const code = `mock_code_${selectedEmail.trim()}`;
    router.push(`/auth/google/callback?code=${encodeURIComponent(code)}`);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f0e13] px-6 py-12 text-foreground">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <Logo />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-white">Google Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Mock sign-in dialog for local development</p>
        </div>

        <GlassCard className="border-border/20 bg-muted/60 p-8 shadow-2xl">
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-medium text-white/90">Choose a development account</h2>
              <div className="mt-3 space-y-2">
                {SUGGESTED_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    onClick={() => handleLogin(account.email)}
                    className="flex w-full items-center justify-between rounded-xl border border-border/15 bg-muted/60 p-3 text-left text-sm transition-colors hover:border-border/30 hover:bg-muted"
                  >
                    <div>
                      <span className="block font-medium text-white">{account.name}</span>
                      <span className="block text-xs text-muted-foreground">{account.email}</span>
                    </div>
                    <Sparkles className="h-4 w-4 text-primary opacity-60" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-muted" /> or use a custom one <span className="h-px flex-1 bg-muted" />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLogin(email);
              }}
              className="space-y-4"
            >
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-white/80">Email address</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="h-11 w-full rounded-xl border border-border/20 bg-background pl-10 pr-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </label>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0.55_0.22_277/0.6)] hover:bg-[oklch(0.15_0_0)]"
              >
                Sign in with custom email
              </button>
            </form>
          </div>
        </GlassCard>

        <p className="text-center text-xs text-muted-foreground">
          This mock flow bypasses Google Accounts credentials. When GOOGLE_CLIENT_ID is configured in backend settings, this will automatically redirect to Google's real OAuth portal.
        </p>
      </div>
    </main>
  );
}
