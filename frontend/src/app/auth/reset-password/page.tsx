"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowRight, Lock } from "lucide-react";

import { Disclaimer } from "@/components/daxch/primitives";
import { Logo } from "@/components/daxch/logo";
import { api, setToken } from "@/lib/api";
import { resolvePostAuthPath } from "@/lib/onboarding";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("");

  const submit = async () => {
    if (password !== confirm) {
      setStatus("Passwords do not match.");
      return;
    }
    setStatus("Updating password...");
    try {
      const res = await api.postPublic<{ access_token: string }>("/auth/password/reset", { token, password });
      setToken(res.access_token);
      const next = await resolvePostAuthPath();
      router.replace(next);
    } catch (err) {
      setStatus((err as Error).message);
    }
  };

  if (!token) {
    return <p className="text-sm text-muted-foreground">Invalid reset link.</p>;
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <label className="block text-sm">
        New password
        <div className="relative mt-1.5">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} className="h-11 w-full rounded-sm border border-border/20 pl-10 pr-3" required />
        </div>
      </label>
      <label className="block text-sm">
        Confirm password
        <div className="relative mt-1.5">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} className="h-11 w-full rounded-sm border border-border/20 pl-10 pr-3" required />
        </div>
      </label>
      <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
        Set password <ArrowRight className="h-4 w-4" />
      </button>
      {status && <p className="text-xs text-muted-foreground">{status}</p>}
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
      <Link href="/"><Logo /></Link>
      <div className="flex flex-1 flex-col justify-center py-10">
        <h1 className="font-serif text-2xl font-semibold">Set new password</h1>
        <Suspense fallback={<p className="mt-4 text-sm text-muted-foreground">Loading...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
      <Disclaimer />
    </div>
  );
}
