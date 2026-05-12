export type User = {
  id: string;
  email: string;
  display_name: string;
};

export type AuthSession = {
  user: User;
  expires_at: string;
};

export type ApiError = {
  error_code: string;
  message: string;
  request_id: string;
  details: Record<string, unknown>;
};

export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}

function apiUrl(path: string, apiBaseUrl = getApiBaseUrl()): string {
  return `${apiBaseUrl}${path}`;
}

function requestId(): string {
  const browserCrypto = globalThis.crypto;
  if (browserCrypto?.randomUUID) {
    return browserCrypto.randomUUID();
  }
  if (browserCrypto?.getRandomValues) {
    const values = new Uint32Array(4);
    browserCrypto.getRandomValues(values);
    return `req-${Array.from(values, (value) => value.toString(16).padStart(8, "0")).join("")}`;
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function fetchJson<T>(
  path: string,
  options: RequestInit & { signal?: AbortSignal } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("X-Request-ID", requestId());
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    let apiError: ApiError | null = null;
    try {
      apiError = (await response.json()) as ApiError;
    } catch {
      apiError = null;
    }
    throw new Error(
      apiError?.message ?? `Request failed: ${response.status} ${response.statusText}`,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function fetchCurrentSession(signal?: AbortSignal): Promise<AuthSession> {
  return fetchJson<AuthSession>("/api/v1/auth/session", { signal });
}

export async function signIn(email: string, password: string): Promise<AuthSession> {
  return fetchJson<AuthSession>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function signOut(): Promise<void> {
  await fetchJson<void>("/api/v1/auth/logout", { method: "POST" });
}
