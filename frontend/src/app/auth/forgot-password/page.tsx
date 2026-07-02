"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Mail } from "lucide-react";

import { Disclaimer } from "@/components/daxch/primitives";
import { Logo } from "@/components/daxch/logo";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");

  const submit = async () => {
    setStatus("Sending reset link...");
    try {
      const res = await api.postPublic<{ message: string; debug_token?: string }>("/auth/password/forgot", { email });
      setStatus(res.message);
    } catch (err) {
      setStatus((err as Error).message);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
      <Link href="/"><Logo /></Link>
      <div className="flex flex-1 flex-col justify-center py-10">
        <h1 className="font-serif text-2xl font-semibold">Reset password</h1>
        <p className="mt-2 text-sm text-muted-foreground">We&apos;ll email a link to set a new password.</p>
        <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <label className="block text-sm">
            Email
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 w-full rounded-sm border border-border/20 pl-10 pr-3" required />
            </div>
          </label>
          <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
            Send reset link <ArrowRight className="h-4 w-4" />
          </button>
        </form>
        {status && <p className="mt-4 text-xs text-muted-foreground">{status}</p>}
        <Link href="/login" className="mt-6 text-sm text-primary hover:underline">Back to sign in</Link>
      </div>
      <Disclaimer />
    </div>
  );
}
