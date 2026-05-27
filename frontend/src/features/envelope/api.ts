import { fetchJson } from "../../shared/api/client";
import { draftWriteHeaders } from "../project_document/table-slice";
import type { EnvelopeCommandBody, EnvelopeReadResponse, EnvelopeReadSource } from "./types";

export async function fetchEnvelopeReadModel(
  projectId: string,
  versionId: string,
  source: EnvelopeReadSource,
  signal?: AbortSignal,
): Promise<EnvelopeReadResponse> {
  return fetchJson<EnvelopeReadResponse>(
    `/api/v1/projects/${projectId}/versions/${versionId}/envelope?source=${source}`,
    { signal },
  );
}

export async function postEnvelopeCommand(
  projectId: string,
  versionId: string,
  current: EnvelopeReadResponse,
  body: EnvelopeCommandBody,
): Promise<EnvelopeReadResponse> {
  return fetchJson<EnvelopeReadResponse>(
    `/api/v1/projects/${projectId}/versions/${versionId}/draft/envelope/commands`,
    {
      method: "POST",
      headers: draftWriteHeaders(current),
      body: JSON.stringify(body),
    },
  );
}
