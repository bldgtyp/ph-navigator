export type ApiErrorEnvelope = {
  error_code: string;
  message: string;
  request_id: string;
  details: Record<string, unknown>;
};

export class ApiRequestError extends Error {
  status: number;
  statusText: string;
  errorCode: string | null;
  requestId: string | null;
  details: Record<string, unknown>;

  constructor(response: Response, apiError: ApiErrorEnvelope | null) {
    super(apiError?.message ?? `Request failed: ${response.status} ${response.statusText}`);
    this.name = "ApiRequestError";
    this.status = response.status;
    this.statusText = response.statusText;
    this.errorCode = apiError?.error_code ?? null;
    this.requestId = apiError?.request_id ?? null;
    this.details = apiError?.details ?? {};
  }
}

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

export async function fetchJson<T>(
  path: string,
  options: RequestInit & { signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetchApiResponse(path, options);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function fetchBlob(
  path: string,
  options: RequestInit & { signal?: AbortSignal } = {},
): Promise<Blob> {
  const response = await fetchApiResponse(path, options);
  return response.blob();
}

async function fetchApiResponse(
  path: string,
  options: RequestInit & { signal?: AbortSignal } = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set("X-Request-ID", requestId());
  // Let the browser set the multipart boundary for FormData; only default JSON.
  if (options.body && !headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    let apiError: ApiErrorEnvelope | null = null;
    try {
      apiError = (await response.json()) as ApiErrorEnvelope;
    } catch {
      apiError = null;
    }
    throw new ApiRequestError(response, apiError);
  }
  return response;
}
