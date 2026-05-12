export type HealthResponse = {
  status: "ok";
  service: string;
  phase: string;
  api_version: string;
};

export type VersionResponse = {
  service: string;
  app_version: string;
  api_version: string;
  environment: string;
  git_sha: string | null;
};

export type ServiceStatus = {
  health: HealthResponse;
  version: VersionResponse;
};

export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}

export function apiUrl(path: string, apiBaseUrl = getApiBaseUrl()): string {
  return `${apiBaseUrl}${path}`;
}

async function fetchJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(apiUrl(path), { signal });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export async function fetchServiceStatus(signal: AbortSignal): Promise<ServiceStatus> {
  const [health, version] = await Promise.all([
    fetchJson<HealthResponse>("/api/v1/health", signal),
    fetchJson<VersionResponse>("/api/v1/version", signal),
  ]);

  return { health, version };
}
