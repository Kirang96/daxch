"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { api, setToken } from "@/lib/api";
import { resolvePostAuthPath } from "@/lib/onboarding";

function GoogleCallbackContent() {
  const params = useSearchParams();
  const router = useRouter();
  const code = useMemo(() => params.get("code") || "", [params]);
  const [status, setStatus] = useState("Authenticating with Google...");

  useEffect(() => {
    const authenticate = async () => {
      if (!code) {
        setStatus("Missing auth code from Google. Please try signing in again.");
        return;
      }
      try {
        const response = await api.postPublic<{ access_token: string }>("/auth/google/callback", { code });
        setToken(response.access_token);
        const nextPath = await resolvePostAuthPath();
        setStatus("Signed in successfully. Redirecting...");
        setTimeout(() => router.push(nextPath), 600);
      } catch (error) {
        setStatus(`Google Authentication failed: ${(error as Error).message}`);
      }
    };
    authenticate();
  }, [router, code]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="glass w-full max-w-md rounded-2xl p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Signing in...</h1>
        <p className="mt-3 text-sm text-muted-foreground">{status}</p>
      </section>
    </main>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
          <section className="glass w-full max-w-md rounded-2xl p-8">
            <h1 className="text-2xl font-semibold tracking-tight">Signing in...</h1>
            <p className="mt-3 text-sm text-muted-foreground">Preparing Google authentication...</p>
          </section>
        </main>
      }
    >
      <GoogleCallbackContent />
    </Suspense>
  );
}
