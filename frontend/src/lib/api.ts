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

async function apiFetch<T>(path: string, init?: RequestInit, skipAuth?: boolean): Promise<T> {
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
      logger.error("Unauthorized API request; clearing session", { endpoint: path, status: response.status });
      clearToken();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
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
