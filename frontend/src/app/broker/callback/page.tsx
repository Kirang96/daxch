"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { api } from "@/lib/api";
import { parseBrokerOAuthState, resolveBrokerOAuthReturnPath } from "@/lib/broker-oauth";

function BrokerCallbackContent() {
  const params = useSearchParams();
  const router = useRouter();
  const code = useMemo(() => params.get("code") || "", [params]);
  const requestToken = useMemo(() => params.get("RequestToken") || "", [params]);
  const brokerParam = useMemo(() => params.get("broker") || "", [params]);
  const state = useMemo(() => params.get("state") || "", [params]);
  const [status, setStatus] = useState("Finalizing broker connection...");
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) {
      return;
    }

    const { brokerId } = parseBrokerOAuthState(state);
    const broker = (brokerParam || brokerId).toLowerCase();
    const authValue = broker === "5paisa" ? requestToken : code;

    if (!authValue) {
      setStatus("Missing authorization token from broker.");
      return;
    }

    handledRef.current = true;

    const connect = async () => {
      try {
        const query =
          broker === "5paisa"
            ? `RequestToken=${encodeURIComponent(authValue)}`
            : `code=${encodeURIComponent(authValue)}`;
        await api.post(`/broker/${broker}/callback?${query}`, {});
        const nextPath = resolveBrokerOAuthReturnPath(state);
        setStatus("Broker connected! Redirecting...");
        router.replace(nextPath);
      } catch (error) {
        handledRef.current = false;
        setStatus(`Broker connection failed: ${(error as Error).message}`);
      }
    };
    void connect();
  }, [brokerParam, code, requestToken, router, state]);

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
