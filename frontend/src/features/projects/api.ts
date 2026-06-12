import { fetchJson } from "../../shared/api/client";
import type {
  BtNumberAvailability,
  CreateProjectPayload,
  EpwParseResponse,
  ProjectLocation,
  ProjectLocationUpdateResponse,
  ProjectBulkDeleteResponse,
  ProjectDeletedListResponse,
  ProjectDetail,
  ProjectListResponse,
  UpdateProjectLocationPayload,
  UpdateProjectPayload,
} from "./types";

export async function listProjects(signal?: AbortSignal): Promise<ProjectListResponse> {
  return fetchJson<ProjectListResponse>("/api/v1/projects", { signal });
}

export async function listDeletedProjects(
  signal?: AbortSignal,
): Promise<ProjectDeletedListResponse> {
  return fetchJson<ProjectDeletedListResponse>("/api/v1/projects/deleted", { signal });
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

export async function bulkDeleteProjects(projectIds: string[]): Promise<ProjectBulkDeleteResponse> {
  return fetchJson<ProjectBulkDeleteResponse>("/api/v1/projects/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ project_ids: projectIds, confirm: true }),
  });
}

export async function restoreProject(projectId: string): Promise<ProjectDetail> {
  return fetchJson<ProjectDetail>(`/api/v1/projects/${projectId}/restore`, {
    method: "POST",
  });
}

export async function fetchProject(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectDetail> {
  return fetchJson<ProjectDetail>(`/api/v1/projects/${projectId}`, { signal });
}

export async function updateProject(
  projectId: string,
  payload: UpdateProjectPayload,
): Promise<ProjectDetail> {
  return fetchJson<ProjectDetail>(`/api/v1/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchProjectLocation(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectLocation> {
  return fetchJson<ProjectLocation>(`/api/v1/projects/${projectId}/location`, { signal });
}

export async function updateProjectLocation(
  projectId: string,
  payload: UpdateProjectLocationPayload,
): Promise<ProjectLocationUpdateResponse> {
  return fetchJson<ProjectLocationUpdateResponse>(`/api/v1/projects/${projectId}/location`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function parseProjectLocationEpw(
  projectId: string,
  assetId: string,
): Promise<EpwParseResponse> {
  return fetchJson<EpwParseResponse>(
    `/api/v1/projects/${projectId}/location/epw/parse?asset_id=${encodeURIComponent(assetId)}`,
    { method: "POST" },
  );
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
