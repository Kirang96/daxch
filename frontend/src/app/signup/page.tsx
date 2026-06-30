"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Mail, User } from "lucide-react";

import { Disclaimer } from "@/components/daxch/primitives";
import { Logo } from "@/components/daxch/logo";
import { api } from "@/lib/api";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agree, setAgree] = useState(false);
  const [status, setStatus] = useState("");
  const [debugToken, setDebugToken] = useState("");

  const requestMagicLink = async () => {
    if (!agree) {
      setStatus("Please accept Terms of Service and Privacy Policy.");
      return;
    }
    if (!email.trim()) {
      setStatus("Email is required.");
      return;
    }
    setStatus("Sending sign-in link...");
    try {
      const response = await api.postPublic<{ message: string; debug_token?: string }>("/auth/magic-link/request", {
        email,
        name: name || undefined
      });
      setDebugToken(response.debug_token || "");
      setStatus("Magic link sent. Check your inbox to continue onboarding.");
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
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 grid-bg opacity-30 [mask-image:radial-gradient(60%_50%_at_50%_0%,#000,transparent)]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[600px]" style={{ background: "var(--gradient-hero)" }} />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Sign in →
          </Link>
        </div>

        <div className="flex flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-semibold tracking-tight">Create your account</h1>
          <p className="mt-2 text-sm text-muted-foreground">Create an account, then choose a plan to start monitoring.</p>

          <button
            onClick={handleGoogleLogin}
            type="button"
            className="mt-8 inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium hover:bg-white/[0.07]"
          >
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-white/5" /> or with email <span className="h-px flex-1 bg-white/5" />
          </div>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              requestMagicLink();
            }}
          >
            <Field
              icon={<User className="h-4 w-4" />}
              label="Full name"
              placeholder="Your name"
              value={name}
              onChange={setName}
            />
            <Field
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={setEmail}
            />
            <label className="flex items-start gap-2.5 pt-2 text-xs text-muted-foreground">
              <input
                checked={agree}
                onChange={(event) => setAgree(event.target.checked)}
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary/40"
              />
              <span>
                I agree to the <Link href="/terms" className="underline-offset-4 hover:underline">Terms of Service</Link> and{" "}
                <Link href="/privacy" className="underline-offset-4 hover:underline">Privacy Policy</Link>.
              </span>
            </label>
            <button
              type="submit"
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0.55_0.22_277/0.6)] hover:brightness-110"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          {status && <p className="mt-4 text-xs text-muted-foreground">{status}</p>}
          {debugToken && process.env.NODE_ENV !== "production" && (
            <div className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-900">
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
    </div>
  );
}

function Field({
  icon,
  label,
  type = "text",
  placeholder,
  value,
  onChange
}: {
  icon: React.ReactNode;
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-foreground/80">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-10 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
    </label>
  );
}

