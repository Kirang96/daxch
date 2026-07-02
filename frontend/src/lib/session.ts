import { api, getToken, setToken } from "@/lib/api";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  plan_tier: string;
  is_admin: boolean;
  expires_at: number;
};

function decodeJwtExp(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { exp?: number };
    return payload.exp ?? 0;
  } catch {
    return 0;
  }
}

export function getTokenExpiry(token: string): number {
  return decodeJwtExp(token);
}

export function isTokenExpiringSoon(token: string, withinSeconds = 900): boolean {
  const exp = decodeJwtExp(token);
  if (!exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return exp - now <= withinSeconds;
}

let refreshPromise: Promise<string | null> | null = null;

export async function refreshSession(): Promise<string | null> {
  if (!getToken()) return null;
  if (refreshPromise) return refreshPromise;
  refreshPromise = api
    .post<{ access_token: string }>("/auth/refresh", {})
    .then((res) => {
      setToken(res.access_token);
      return res.access_token;
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

export async function fetchSessionUser(): Promise<SessionUser | null> {
  if (!getToken()) return null;
  try {
    return await api.get<SessionUser>("/auth/me");
  } catch {
    return null;
  }
}

export function scheduleSessionRefresh(onRefresh?: () => void): () => void {
  const tick = () => {
    const token = getToken();
    if (!token) return;
    if (isTokenExpiringSoon(token)) {
      void refreshSession().then((t) => {
        if (t) onRefresh?.();
      });
    }
  };
  tick();
  const interval = setInterval(tick, 5 * 60 * 1000);
  const onFocus = () => tick();
  window.addEventListener("focus", onFocus);
  return () => {
    clearInterval(interval);
    window.removeEventListener("focus", onFocus);
  };
}
