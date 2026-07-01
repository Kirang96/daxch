"use client";

import { useEffect } from "react";

import { logger } from "@/lib/logger";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Unhandled page error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="font-serif text-xl font-semibold">Something went wrong</h2>
      <p className="max-w-md text-sm text-muted-foreground">{error.message || "An unexpected error occurred."}</p>
      <button
        onClick={reset}
        className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-[oklch(0.15_0_0)]"
      >
        Try again
      </button>
    </div>
  );
}
