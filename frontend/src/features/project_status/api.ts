import { fetchJson } from "../../shared/api/client";
import type { StatusItem, StatusItemListResponse, StatusItemPayload } from "./types";

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
