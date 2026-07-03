"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Lock, Mail, User } from "lucide-react";

import { Disclaimer } from "@/components/daxch/primitives";
import { Logo } from "@/components/daxch/logo";
import { LandingAuthRedirect } from "@/components/landing/landing-auth-redirect";
import { api, setToken } from "@/lib/api";
import { resolvePostAuthPath } from "@/lib/onboarding";

const inputClass =
  "h-11 w-full rounded-sm border border-border/20 bg-background pl-10 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [status, setStatus] = useState("");
  const [magicLinkEnabled, setMagicLinkEnabled] = useState(false);
  const [debugToken, setDebugToken] = useState("");

  useEffect(() => {
    api.getPublic<{ magic_link_enabled: boolean }>("/auth/config").then((c) => setMagicLinkEnabled(c.magic_link_enabled)).catch(() => {});
  }, []);

  const register = async () => {
    if (!agree) {
      setStatus("Please accept Terms of Service and Privacy Policy.");
      return;
    }
    if (!magicLinkEnabled) {
      if (password.length < 8) {
        setStatus("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setStatus("Passwords do not match.");
        return;
      }
    }
    setStatus(magicLinkEnabled ? "Sending sign-in link..." : "Creating account...");
    try {
      if (magicLinkEnabled) {
        const response = await api.postPublic<{ message: string; debug_token?: string }>("/auth/magic-link/request", {
          email,
          name: name || undefined,
        });
        setDebugToken(response.debug_token || "");
        setStatus("Magic link sent. Check your inbox to continue onboarding.");
      } else {
        const response = await api.postPublic<{ access_token: string }>("/auth/register", {
          email,
          password,
          name: name || undefined,
        });
        setToken(response.access_token);
        const nextPath = await resolvePostAuthPath();
        router.replace(nextPath);
      }
    } catch (error) {
      setStatus(`Signup failed: ${(error as Error).message}`);
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
    <div className="relative min-h-screen overflow-hidden bg-background">
      <LandingAuthRedirect />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          <Link href="/login" className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground">
            Sign in →
          </Link>
        </div>

        <div className="flex flex-1 flex-col justify-center py-10">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Create your account</h1>
          <p className="mt-2 text-sm text-muted-foreground">Create an account, then choose a plan to start monitoring.</p>

          <button
            onClick={handleGoogleLogin}
            type="button"
            className="mt-8 inline-flex w-full items-center justify-center gap-2.5 rounded-sm border border-border/20 bg-muted px-4 py-2.5 text-sm font-medium transition-colors hover:bg-background"
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
              void register();
            }}
          >
            <Field icon={<User className="h-4 w-4" />} label="Full name" placeholder="Your name" value={name} onChange={setName} />
            <Field icon={<Mail className="h-4 w-4" />} label="Email" type="email" placeholder="you@company.com" value={email} onChange={setEmail} />
            {!magicLinkEnabled && (
              <>
                <Field icon={<Lock className="h-4 w-4" />} label="Password" type="password" placeholder="At least 8 characters" value={password} onChange={setPassword} />
                <Field icon={<Lock className="h-4 w-4" />} label="Confirm password" type="password" placeholder="Repeat password" value={confirmPassword} onChange={setConfirmPassword} />
              </>
            )}
            <label className="flex items-start gap-2.5 pt-2 text-xs text-muted-foreground">
              <input
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded-sm border-border/30 bg-background text-primary focus:ring-primary/40"
              />
              <span>
                I agree to the <Link href="/terms" className="underline-offset-4 hover:underline">Terms</Link> and{" "}
                <Link href="/privacy" className="underline-offset-4 hover:underline">Privacy Policy</Link>.
              </span>
            </label>
            <button type="submit" className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold uppercase tracking-wider text-primary-foreground hover:bg-[oklch(0.15_0_0)]">
              {magicLinkEnabled ? "Send magic link" : "Create account"} <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          {status && <p className="mt-4 text-xs text-muted-foreground">{status}</p>}
          {debugToken && magicLinkEnabled && (
            <div className="mt-3 rounded-sm border border-amber-400/50 bg-amber-50 p-3 text-xs text-amber-900">
              <Link href={`/auth/verify?token=${encodeURIComponent(debugToken)}`} className="text-primary underline">
                Continue with dev token
              </Link>
            </div>
          )}
        </div>
        <Disclaimer />
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="editorial-label mb-1.5 block text-muted-foreground">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} required />
      </div>
    </label>
  );
}
