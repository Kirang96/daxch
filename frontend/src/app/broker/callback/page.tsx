"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { api } from "@/lib/api";

function BrokerCallbackContent() {
  const params = useSearchParams();
  const router = useRouter();
  const code = useMemo(() => params.get("code") || "", [params]);
  const state = useMemo(() => params.get("state") || "", [params]);
  const [status, setStatus] = useState("Finalizing broker connection...");

  useEffect(() => {
    const connect = async () => {
      if (!code) {
        setStatus("Missing authorization code from broker.");
        return;
      }
      try {
        await api.post(`/broker/upstox/callback?code=${encodeURIComponent(code)}`, {});
        const nextPath =
          state === "onboarding"
            ? "/onboarding/subscription?broker=connected"
            : "/settings?broker=connected";
        setStatus("Broker connected! Redirecting...");
        setTimeout(() => router.push(nextPath), 900);
      } catch (error) {
        setStatus(`Broker connection failed: ${(error as Error).message}`);
      }
    };
    connect();
  }, [code, router, state]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="glass w-full max-w-md rounded-2xl p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Broker Callback</h1>
        <p className="mt-3 text-sm text-muted-foreground">{status}</p>
      </section>
    </main>
  );
}

export default function BrokerCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
          <section className="glass w-full max-w-md rounded-2xl p-8">
            <h1 className="text-2xl font-semibold tracking-tight">Broker Callback</h1>
            <p className="mt-3 text-sm text-muted-foreground">Preparing broker connection...</p>
          </section>
        </main>
      }
    >
      <BrokerCallbackContent />
    </Suspense>
  );
}

