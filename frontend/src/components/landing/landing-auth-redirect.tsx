"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getToken } from "@/lib/api";
import { resolvePostAuthPath } from "@/lib/onboarding";

export function LandingAuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) return;

    let cancelled = false;
    void resolvePostAuthPath().then((path) => {
      if (!cancelled) router.replace(path);
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
