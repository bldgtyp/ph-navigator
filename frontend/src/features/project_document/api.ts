import { fetchJson, getApiBaseUrl } from "../../shared/api/client";
import type {
  DiffSummary,
  ProjectDocumentResponse,
  ProjectDraftStatus,
  SaveAsPayload,
  SaveDraftResponse,
} from "./types";

export async function fetchDraftSummary(
  projectId: string,
  versionId: string,
  signal?: AbortSignal,
): Promise<ProjectDraftStatus> {
  return fetchJson<ProjectDraftStatus>(
    `/api/v1/projects/${projectId}/versions/${versionId}/draft`,
    { signal },
  );
}

export async function fetchProjectDocument(
  projectId: string,
  versionId: string,
  signal?: AbortSignal,
): Promise<ProjectDocumentResponse> {
  return fetchJson<ProjectDocumentResponse>(
    `/api/v1/projects/${projectId}/versions/${versionId}/document`,
    { signal },
  );
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
