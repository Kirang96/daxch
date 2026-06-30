"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, Bot, Lock, Mail, ShieldCheck } from "lucide-react";

import { api } from "@/lib/api";
import { Badge, Disclaimer, GlassCard, Sparkline } from "@/components/daxch/primitives";
import { Logo } from "@/components/daxch/logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [debugToken, setDebugToken] = useState("");

  const requestMagicLink = async () => {
    setStatus("Sending secure sign-in link...");
    try {
      const response = await api.postPublic<{ message: string; debug_token?: string }>("/auth/magic-link/request", { email });
      setDebugToken(response.debug_token || "");
      setStatus("Sign-in link sent. Check your inbox.");
    } catch (error) {
      setStatus(`Error: ${(error as Error).message}`);
    }
  };

  const handleGoogleLogin = async () => {
    setStatus("Redirecting to Google...");
    try {
      const response = await api.get<{ url: string }>("/auth/google/login");
      window.location.href = response.url;
    } catch (error) {
      setStatus(`Failed to initiate Google sign-in: ${(error as Error).message}`);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative flex flex-col px-6 py-8 md:px-12">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          <Link href="/signup" className="text-sm text-muted-foreground hover:text-foreground">
            Create account →
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-3xl font-semibold tracking-tight">Welcome back.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your AI agents have been quietly working. Sign in to see what&apos;s new.
          </p>

          <button
            onClick={handleGoogleLogin}
            className="mt-8 inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-border/20 bg-muted px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/70 transition-colors"
          >
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border/20" /> or with email <span className="h-px flex-1 bg-border/20" />
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              requestMagicLink();
            }}
          >
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-foreground/80">Email</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                </span>
                 <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="you@company.com"
                  className="h-11 w-full rounded-xl border border-border/20 bg-muted/60 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </label>
            <label className="block">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-foreground/80">Passwordless login</span>
                <span className="text-xs text-primary">Magic link</span>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <Lock className="h-4 w-4" />
                </span>
                 <input
                  type="text"
                  disabled
                  value="Secure email link"
                  className="h-11 w-full rounded-xl border border-border/20 bg-muted/40 pl-10 pr-3 text-sm text-muted-foreground"
                />
              </div>
            </label>

            <button className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0.55_0.22_277/0.6)] hover:brightness-110">
              Send Magic Link <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {status && <p className="mt-4 text-xs text-muted-foreground">{status}</p>}

          {debugToken && process.env.NODE_ENV !== "production" && (
            <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-50 p-3 text-xs text-amber-800">
              <p>Development mode token:</p>
              <p className="mt-2 break-all">{debugToken}</p>
              <Link href={`/auth/verify?token=${encodeURIComponent(debugToken)}`} className="mt-2 inline-block text-primary underline">
                Continue with this token
              </Link>
            </div>
          )}
        </div>
        <Disclaimer />
      </div>

      <div className="relative hidden overflow-hidden border-l border-border/12 bg-muted/30 lg:block">
        <div aria-hidden className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
        <div aria-hidden className="absolute inset-0 grid-bg opacity-40" />
        <div className="relative grid h-full place-items-center p-12">
          <div className="space-y-6">
            <GlassCard className="w-[420px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Agent · INFY</div>
                    <div className="text-xs text-muted-foreground">Last analysis · 4 min ago</div>
                  </div>
                </div>
                <Badge variant="success">● Healthy</Badge>
              </div>
              <Sparkline data={[12, 14, 13, 16, 15, 17, 19, 18, 20, 22, 21, 23, 25]} color="oklch(var(--success))" className="mt-5" height={70} />
              <div className="mt-4 flex items-center justify-between text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Confidence</div>
                  <div className="font-medium">High · 82%</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Conclusion</div>
                  <div className="font-medium">Hold</div>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="ml-12 w-[360px]">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Activity className="h-3.5 w-3.5 text-primary" /> Watching now
              </div>
              <div className="mt-3 space-y-2 text-sm">
                {[
                  ["Reliance", "₹2,948", "+1.8%"],
                  ["HDFC Bank", "₹1,612", "+0.4%"],
                  ["TCS", "₹3,820", "−0.6%"]
                ].map(([name, value, delta]) => (
                  <div key={name} className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2">
                    <span className="text-foreground/80">{name}</span>
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium">{value}</span>
                      <span className={`text-xs ${delta.startsWith("+") ? "text-emerald-400" : "text-red-400"}`}>{delta}</span>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="ml-32 w-[300px]">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Risk alerts off
              </div>
              <p className="mt-2 text-sm">No portfolio risks detected in the last 24h.</p>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
