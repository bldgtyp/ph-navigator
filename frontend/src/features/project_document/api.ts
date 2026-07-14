import { fetchJson, getApiBaseUrl } from "../../shared/api/client";
import type { BaseTableSlice } from "./table-slice";
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

// One request for many draft table slices, replacing the per-table fan-out on
// page mount. Returns the response's `tables` map (table_name -> per-table
// slice), each entry byte-identical to `GET …/draft/tables/<name>` so it seeds
// the matching per-table cache 1:1. See `useDraftTablesBatchSeed`.
export async function fetchDraftTablesBatch(
  projectId: string,
  versionId: string,
  names: string[],
  signal?: AbortSignal,
): Promise<Record<string, BaseTableSlice>> {
  const query = new URLSearchParams();
  for (const name of names) query.append("names", name);
  const response = await fetchJson<{ tables: Record<string, BaseTableSlice> }>(
    `/api/v1/projects/${projectId}/versions/${versionId}/draft/tables?${query.toString()}`,
    { signal },
  );
  return response.tables;
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
