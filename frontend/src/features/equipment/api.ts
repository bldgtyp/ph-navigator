import { fetchJson } from "../../shared/api/client";
import type { RoomsReplacePayload, RoomsSlice } from "./types";

export async function fetchRoomsSlice(
  projectId: string,
  versionId: string,
  accessMode: "editor" | "viewer",
  signal?: AbortSignal,
): Promise<RoomsSlice> {
  const path =
    accessMode === "editor"
      ? `/api/v1/projects/${projectId}/versions/${versionId}/draft/tables/rooms`
      : `/api/v1/projects/${projectId}/versions/${versionId}/document/tables/rooms`;
  return fetchJson<RoomsSlice>(path, { signal });
}

export async function replaceRoomsSlice(
  projectId: string,
  versionId: string,
  current: RoomsSlice,
  payload: RoomsReplacePayload,
): Promise<RoomsSlice> {
  const headers = new Headers();
  if (current.draft_etag) {
    headers.set("If-Match", current.draft_etag);
  } else {
    headers.set("If-Match-Version", current.version_etag);
  }
  return fetchJson<RoomsSlice>(
    `/api/v1/projects/${projectId}/versions/${versionId}/draft/tables/rooms`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    },
  );
}
