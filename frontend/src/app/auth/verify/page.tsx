"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { api, setToken } from "@/lib/api";
import { resolvePostAuthPath } from "@/lib/onboarding";

function VerifyContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = useMemo(() => params.get("token") || "", [params]);
  const [status, setStatus] = useState("Verifying sign-in link...");

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus("Missing token. Please request a new sign-in link.");
        return;
      }
      try {
        const response = await api.postPublic<{ access_token: string }>("/auth/magic-link/verify", { token });
        setToken(response.access_token);
        const nextPath = await resolvePostAuthPath();
        setStatus("Signed in successfully. Redirecting...");
        setTimeout(() => router.push(nextPath), 600);
      } catch (error) {
        setStatus(`Verification failed: ${(error as Error).message}`);
      }
    };
    verify();
  }, [router, token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="glass w-full max-w-md rounded-2xl p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Verifying your link</h1>
        <p className="mt-3 text-sm text-muted-foreground">{status}</p>
      </section>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
          <section className="glass w-full max-w-md rounded-2xl p-8">
            <h1 className="text-2xl font-semibold tracking-tight">Verifying your link</h1>
            <p className="mt-3 text-sm text-muted-foreground">Preparing verification...</p>
          </section>
        </main>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}

