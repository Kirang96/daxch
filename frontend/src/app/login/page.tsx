"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, Bot, Lock, Mail, ShieldCheck } from "lucide-react";

import { api, setToken } from "@/lib/api";
import { resolvePostAuthPath } from "@/lib/onboarding";
import { Badge, Disclaimer, GlassCard, Sparkline } from "@/components/daxch/primitives";
import { Logo } from "@/components/daxch/logo";
import { LandingAuthRedirect } from "@/components/landing/landing-auth-redirect";

const inputClass =
  "h-11 w-full rounded-sm border border-border/20 bg-background pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [magicLinkEnabled, setMagicLinkEnabled] = useState(false);
  const [debugToken, setDebugToken] = useState("");

  useEffect(() => {
    api.getPublic<{ magic_link_enabled: boolean }>("/auth/config").then((c) => setMagicLinkEnabled(c.magic_link_enabled)).catch(() => {});
  }, []);

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

  const loginWithPassword = async () => {
    setStatus("Signing in...");
    try {
      const response = await api.postPublic<{ access_token: string }>("/auth/login", { email, password });
      setToken(response.access_token);
      const nextPath = await resolvePostAuthPath();
      router.replace(nextPath);
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
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <LandingAuthRedirect />
      <div className="relative flex flex-col px-6 py-8 md:px-12">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          <Link href="/signup" className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground">
            Create account →
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Welcome back.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your AI agents have been quietly working. Sign in to see what&apos;s new.
          </p>

          <button
            onClick={handleGoogleLogin}
            type="button"
            className="mt-8 inline-flex w-full items-center justify-center gap-2.5 rounded-sm border border-border/20 bg-muted px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-background"
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
              if (magicLinkEnabled && !password) {
                void requestMagicLink();
              } else {
                void loginWithPassword();
              }
            }}
          >
            <label className="block">
              <span className="editorial-label mb-1.5 block text-muted-foreground">Email</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="you@company.com"
                  className={inputClass}
                  required
                />
              </div>
            </label>
            {!magicLinkEnabled && (
              <label className="block">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="editorial-label text-muted-foreground">Password</span>
                  <Link href="/auth/forgot-password" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="Your password"
                    className={inputClass}
                    required
                    minLength={8}
                  />
                </div>
              </label>
            )}

            <button
              type="submit"
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition-colors hover:bg-[oklch(0.15_0_0)]"
            >
              {magicLinkEnabled ? "Send Magic Link" : "Sign in"} <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {status && <p className="mt-4 text-xs text-muted-foreground">{status}</p>}

          {debugToken && magicLinkEnabled && (
            <div className="mt-4 rounded-sm border border-amber-400/50 bg-amber-50 p-3 text-xs text-amber-800">
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

      <div className="relative hidden overflow-hidden border-l border-border/20 bg-muted lg:block">
        <div className="relative grid h-full place-items-center p-12">
          <div className="space-y-6">
            <GlassCard editorialShadow className="w-[420px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-sm bg-primary/10 text-primary ring-1 ring-primary/20">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Agent · INFY</div>
                    <div className="text-xs text-muted-foreground">Last analysis · 4 min ago</div>
                  </div>
                </div>
                <Badge variant="success">● Healthy</Badge>
              </div>
              <Sparkline data={[12, 14, 13, 16, 15, 17, 19, 18, 20, 22, 21, 23, 25]} color="oklch(var(--chart-2))" className="mt-5" height={70} />
            </GlassCard>
            <GlassCard className="ml-12 w-[360px]">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Activity className="h-3.5 w-3.5 text-primary" /> Watching now
              </div>
            </GlassCard>
            <GlassCard className="ml-32 w-[300px]">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Risk alerts off
              </div>
              <p className="mt-2 text-sm">No portfolio risks detected in the last 24h.</p>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
