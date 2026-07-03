"use client";

import { useEffect } from "react";

const RELOAD_KEY = "daxch_chunk_reload";

function isChunkLoadError(reason: unknown): boolean {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : "";
  return /loading chunk|failed to fetch dynamically imported module|chunkloaderror/i.test(message);
}

export function ChunkLoadRecovery() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      sessionStorage.removeItem(RELOAD_KEY);
    }, 30_000);

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isChunkLoadError(event.reason)) return;
      if (sessionStorage.getItem(RELOAD_KEY)) return;

      event.preventDefault();
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
