import { logger } from "@/lib/logger";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api/v1";
const TOKEN_KEY = "daxch_token";

if (typeof window !== "undefined" && !process.env.NEXT_PUBLIC_API_BASE_URL) {
  logger.warn("NEXT_PUBLIC_API_BASE_URL is not set; API calls will use /api/v1", { module: "api" });
}

export function getToken(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function parseErrorBody(body: string, status: number): { message: string; code?: string } {
  if (!body) {
    return { message: `Request failed with status ${status}` };
  }
  try {
    const parsed = JSON.parse(body) as {
      detail?: string | { msg?: string; code?: string; message?: string } | { msg?: string }[];
      error?: { message?: string; code?: string };
    };
    if (typeof parsed.detail === "string") {
      return { message: parsed.detail };
    }
    if (parsed.detail && typeof parsed.detail === "object" && !Array.isArray(parsed.detail)) {
      const detail = parsed.detail as { msg?: string; code?: string; message?: string };
      return {
        message: detail.message || detail.msg || `Request failed with status ${status}`,
        code: detail.code
      };
    }
    if (Array.isArray(parsed.detail) && parsed.detail[0]?.msg) {
      return { message: parsed.detail[0].msg };
    }
    if (parsed.error?.message) {
      return { message: parsed.error.message, code: parsed.error.code };
    }
  } catch {
    // fall through to raw body
  }
  return { message: body };
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function tryRefreshToken(): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: "{}"
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { access_token?: string };
    if (data.access_token) {
      setToken(data.access_token);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function forceLogout(path: string, status: number) {
  logger.error("Session ended", { endpoint: path, status });
  clearToken();
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit, skipAuth?: boolean, retried = false): Promise<T> {
  const token = getToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(!skipAuth && token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers || {})
      }
    });
  } catch {
    throw new Error("Could not reach the API. Check that the backend is running and try again.");
  }
  if (!response.ok) {
    const body = await response.text();
    const { message, code } = parseErrorBody(body, response.status);
    if (response.status === 401 && !skipAuth) {
      const authEndpoint = path.startsWith("/auth/me") || path.startsWith("/auth/refresh");
      if (!retried && !authEndpoint) {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
          return apiFetch<T>(path, init, skipAuth, true);
        }
      }
      forceLogout(path, response.status);
    }
    logger.warn("API request failed", { endpoint: path, status: response.status, message });
    throw new ApiError(message, response.status, code);
  }
  if (response.status === 204) {
    return {} as T;
  }
  return response.json() as Promise<T>;
}

export const api = {
  getPublic: <T>(path: string) => apiFetch<T>(path, undefined, true),
  postPublic: <T>(path: string, body: unknown) =>
    apiFetch<T>(
      path,
      {
        method: "POST",
        body: JSON.stringify(body)
      },
      true
    ),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, {
      method: "POST",
      body: JSON.stringify(body)
    }),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body)
    }),
  get: <T>(path: string) => apiFetch<T>(path),
  del: <T>(path: string) =>
    apiFetch<T>(path, {
      method: "DELETE"
    })
};
