import { fetchJson } from "../../shared/api/client";
import {
  SIDEBAR_VIEW_SCHEMA_VERSION,
  type SidebarViewResponse,
  type SidebarViewState,
  type SidebarViewUpsertRequest,
} from "./types";

function endpoint(projectId: string, viewKey: string): string {
  return `/api/v1/projects/${projectId}/sidebar-views/${viewKey}`;
}

export async function fetchSidebarView(
  projectId: string,
  viewKey: string,
  signal?: AbortSignal,
): Promise<SidebarViewResponse> {
  return fetchJson<SidebarViewResponse>(endpoint(projectId, viewKey), { signal });
}

export async function saveSidebarView(
  projectId: string,
  viewKey: string,
  viewState: SidebarViewState,
  signal?: AbortSignal,
): Promise<SidebarViewResponse> {
  const body: SidebarViewUpsertRequest = {
    view_state_schema_version: SIDEBAR_VIEW_SCHEMA_VERSION,
    view_state: viewState,
  };
  return fetchJson<SidebarViewResponse>(endpoint(projectId, viewKey), {
    method: "PUT",
    body: JSON.stringify(body),
    signal,
  });
}

export async function deleteSidebarView(
  projectId: string,
  viewKey: string,
  signal?: AbortSignal,
): Promise<void> {
  await fetchJson<void>(endpoint(projectId, viewKey), {
    method: "DELETE",
    signal,
  });
}
