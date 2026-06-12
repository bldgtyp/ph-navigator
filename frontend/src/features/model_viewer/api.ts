import { fetchJson, getApiBaseUrl } from "../../shared/api/client";
import type {
  HbjsonFile,
  HbjsonFileCreatePayload,
  HbjsonFileListResponse,
  HbjsonFileUpdatePayload,
} from "./types";

export async function fetchHbjsonFiles(
  projectId: string,
  signal?: AbortSignal,
): Promise<HbjsonFileListResponse> {
  return fetchJson<HbjsonFileListResponse>(`/api/v1/projects/${projectId}/hbjson-files`, {
    signal,
  });
}

/** The post-upload link step: attach a completed hbjson asset to the file list. */
export async function createHbjsonFile(
  projectId: string,
  payload: HbjsonFileCreatePayload,
): Promise<HbjsonFile> {
  return fetchJson<HbjsonFile>(`/api/v1/projects/${projectId}/hbjson-files`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateHbjsonFile(
  projectId: string,
  fileId: string,
  payload: HbjsonFileUpdatePayload,
): Promise<HbjsonFile> {
  return fetchJson<HbjsonFile>(`/api/v1/projects/${projectId}/hbjson-files/${fileId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteHbjsonFile(projectId: string, fileId: string): Promise<void> {
  await fetchJson<void>(`/api/v1/projects/${projectId}/hbjson-files/${fileId}`, {
    method: "DELETE",
  });
}

export function hbjsonFileDownloadPath(projectId: string, fileId: string): string {
  return `${getApiBaseUrl()}/api/v1/projects/${projectId}/hbjson-files/${fileId}/download`;
}
