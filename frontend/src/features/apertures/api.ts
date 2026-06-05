import { fetchJson } from "../../shared/api/client";
import { draftWriteHeaders } from "../project_document/table-slice";
import type { ApertureCommand, AperturesSlice } from "./types";

export async function fetchAperturesSlice(
  projectId: string,
  versionId: string,
  accessMode: "editor" | "viewer",
  signal?: AbortSignal,
): Promise<AperturesSlice> {
  const path =
    accessMode === "editor"
      ? `/api/v1/projects/${projectId}/versions/${versionId}/draft/tables/apertures`
      : `/api/v1/projects/${projectId}/versions/${versionId}/document/tables/apertures`;
  return fetchJson<AperturesSlice>(path, { signal });
}

export async function applyApertureCommand(
  projectId: string,
  versionId: string,
  current: AperturesSlice,
  command: ApertureCommand,
): Promise<AperturesSlice> {
  return fetchJson<AperturesSlice>(
    `/api/v1/projects/${projectId}/versions/${versionId}/apertures/command`,
    {
      method: "POST",
      headers: draftWriteHeaders(current),
      body: JSON.stringify(command),
    },
  );
}
