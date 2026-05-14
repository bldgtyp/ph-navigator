import { fetchJson } from "../../shared/api/client";
import type { WindowTypesReplacePayload, WindowTypesSlice } from "./types";

export async function fetchWindowTypesSlice(
  projectId: string,
  versionId: string,
  accessMode: "editor" | "viewer",
  signal?: AbortSignal,
): Promise<WindowTypesSlice> {
  const path =
    accessMode === "editor"
      ? `/api/v1/projects/${projectId}/versions/${versionId}/draft/tables/window_types`
      : `/api/v1/projects/${projectId}/versions/${versionId}/document/tables/window_types`;
  return fetchJson<WindowTypesSlice>(path, { signal });
}

export async function replaceWindowTypesSlice(
  projectId: string,
  versionId: string,
  current: WindowTypesSlice,
  payload: WindowTypesReplacePayload,
): Promise<WindowTypesSlice> {
  const headers = new Headers();
  if (current.draft_etag) {
    headers.set("If-Match", current.draft_etag);
  } else {
    headers.set("If-Match-Version", current.version_etag);
  }
  return fetchJson<WindowTypesSlice>(
    `/api/v1/projects/${projectId}/versions/${versionId}/draft/tables/window_types`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    },
  );
}
