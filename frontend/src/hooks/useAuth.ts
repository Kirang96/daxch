"use client";

import { clearToken, getToken } from "@/lib/api";

export function useAuth() {
  const token = getToken();
  const isAuthenticated = Boolean(token);

  const logout = () => {
    clearToken();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  };

  return { token, isAuthenticated, logout };
}

