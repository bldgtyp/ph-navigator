import { fetchJson, getApiBaseUrl } from "../../shared/api/client";
import type {
  BtNumberAvailability,
  CreateProjectPayload,
  DiffSummary,
  ProjectDetail,
  ProjectListResponse,
  SaveAsPayload,
  SaveDraftResponse,
} from "./types";

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

export async function saveDraft(
  projectId: string,
  versionId: string,
  versionEtag: string,
): Promise<SaveDraftResponse> {
  return fetchJson<SaveDraftResponse>(
    `/api/v1/projects/${projectId}/versions/${versionId}/draft/save`,
    {
      method: "POST",
      headers: { "If-Match": versionEtag },
    },
  );
}

export async function saveDraftAs(
  projectId: string,
  versionId: string,
  payload: SaveAsPayload,
): Promise<SaveDraftResponse> {
  return fetchJson<SaveDraftResponse>(
    `/api/v1/projects/${projectId}/versions/${versionId}/draft/save-as`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function discardDraft(projectId: string, versionId: string): Promise<void> {
  await fetchJson(`/api/v1/projects/${projectId}/versions/${versionId}/draft`, {
    method: "DELETE",
  });
}

export async function patchVersion(
  projectId: string,
  versionId: string,
  payload: { locked?: boolean; make_active?: boolean },
): Promise<ProjectDetail> {
  return fetchJson<ProjectDetail>(`/api/v1/projects/${projectId}/versions/${versionId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchDiff(
  projectId: string,
  fromVersionId: string,
  to: string,
  signal?: AbortSignal,
): Promise<DiffSummary> {
  return fetchJson<DiffSummary>(
    `/api/v1/projects/${projectId}/diff?from=${encodeURIComponent(fromVersionId)}&to=${encodeURIComponent(to)}`,
    { signal },
  );
}

export function projectDownloadUrl(projectId: string, versionId: string): string {
  return `${getApiBaseUrl()}/api/v1/projects/${projectId}/versions/${versionId}/download`;
}

export function tableDownloadUrl(projectId: string, versionId: string, tableName: string): string {
  return `${getApiBaseUrl()}/api/v1/projects/${projectId}/versions/${versionId}/download/tables/${tableName}`;
}
