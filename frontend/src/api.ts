export type User = {
  id: string;
  email: string;
  display_name: string;
};

export type AuthSession = {
  user: User;
  expires_at: string;
};

export type CertificationProgram = "phi" | "phius";

export type ProjectVersion = {
  id: string;
  project_id: string;
  name: string;
  kind: "working" | "submitted" | "closed" | "snapshot";
  locked: boolean;
  schema_version: number;
  body_size_bytes: number;
  created_at: string;
  updated_at: string;
};

export type ProjectSummary = {
  id: string;
  name: string;
  bt_number: string;
  client: string | null;
  cert_programs: CertificationProgram[];
  phius_number: string | null;
  phius_dropbox_url: string | null;
  active_version_id: string | null;
  last_saved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectDetail = ProjectSummary & {
  versions: ProjectVersion[];
  active_version: ProjectVersion | null;
  access_mode: "editor" | "viewer";
};

export type ProjectListResponse = {
  projects: ProjectSummary[];
};

export type StatusState = "todo" | "done" | "na";

export type StatusItem = {
  id: string;
  project_id: string;
  order_index: number;
  title: string;
  state: StatusState;
  completion_date: string | null;
  description: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type StatusItemListResponse = {
  items: StatusItem[];
};

export type StatusItemPayload = {
  title?: string;
  state?: StatusState;
  completion_date?: string | null;
  description?: string | null;
  order_index?: number;
};

export type CreateProjectPayload = {
  name: string;
  bt_number: string;
  client: string | null;
  cert_programs: CertificationProgram[];
  phius_number: string | null;
  phius_dropbox_url: string | null;
};

export type BtNumberAvailability = {
  available: boolean;
  conflict: { id: string; name: string } | null;
};

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
    let apiError: ApiErrorEnvelope | null = null;
    try {
      apiError = (await response.json()) as ApiErrorEnvelope;
    } catch {
      apiError = null;
    }
    throw new ApiRequestError(response, apiError);
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

export async function listProjects(signal?: AbortSignal): Promise<ProjectListResponse> {
  return fetchJson<ProjectListResponse>("/api/v1/projects", { signal });
}

export async function checkBtNumber(
  value: string,
  signal?: AbortSignal,
): Promise<BtNumberAvailability> {
  return fetchJson<BtNumberAvailability>(
    `/api/v1/projects/check-bt-number?value=${encodeURIComponent(value)}`,
    { signal },
  );
}

export async function createProject(payload: CreateProjectPayload): Promise<ProjectDetail> {
  return fetchJson<ProjectDetail>("/api/v1/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchProject(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectDetail> {
  return fetchJson<ProjectDetail>(`/api/v1/projects/${projectId}`, { signal });
}

export async function fetchStatusItems(
  projectId: string,
  signal?: AbortSignal,
): Promise<StatusItemListResponse> {
  return fetchJson<StatusItemListResponse>(`/api/v1/projects/${projectId}/status-items`, {
    signal,
  });
}

export async function applyDefaultStatusTemplate(
  projectId: string,
): Promise<StatusItemListResponse> {
  return fetchJson<StatusItemListResponse>(
    `/api/v1/projects/${projectId}/status-items/apply-default-template`,
    { method: "POST" },
  );
}

export async function createStatusItem(
  projectId: string,
  payload: StatusItemPayload,
): Promise<StatusItem> {
  return fetchJson<StatusItem>(`/api/v1/projects/${projectId}/status-items`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateStatusItem(
  projectId: string,
  itemId: string,
  payload: StatusItemPayload,
): Promise<StatusItem> {
  return fetchJson<StatusItem>(`/api/v1/projects/${projectId}/status-items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteStatusItem(projectId: string, itemId: string): Promise<void> {
  await fetchJson<void>(`/api/v1/projects/${projectId}/status-items/${itemId}`, {
    method: "DELETE",
  });
}
