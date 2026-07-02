"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { api } from "@/lib/api";
import { resolveBrokerOAuthReturnPath } from "@/lib/broker-oauth";

function BrokerCallbackContent() {
  const params = useSearchParams();
  const router = useRouter();
  const code = useMemo(() => params.get("code") || "", [params]);
  const state = useMemo(() => params.get("state") || "", [params]);
  const [status, setStatus] = useState("Finalizing broker connection...");
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) {
      return;
    }
    if (!code) {
      setStatus("Missing authorization code from broker.");
      return;
    }

    handledRef.current = true;

    const connect = async () => {
      try {
        await api.post(`/broker/upstox/callback?code=${encodeURIComponent(code)}`, {});
        const nextPath = resolveBrokerOAuthReturnPath(state);
        setStatus("Broker connected! Redirecting...");
        router.replace(nextPath);
      } catch (error) {
        handledRef.current = false;
        setStatus(`Broker connection failed: ${(error as Error).message}`);
      }
    };
    void connect();
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
