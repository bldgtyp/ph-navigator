import { fetchJson } from "../../../../shared/api/client";
import type { CatalogFile, CommitResponse, PreviewResponse } from "./types";

export async function previewCatalogImport(file: CatalogFile): Promise<PreviewResponse> {
  return fetchJson<PreviewResponse>("/api/v1/catalogs/glazing-types/import/preview", {
    method: "POST",
    body: JSON.stringify(file),
  });
}

// Accepts the full parsed file dict so the importer's per-row warning
// surface flows even when the file's shape doesn't match CatalogFile
// exactly — the backend's coerce step is the source of truth.
export async function previewCatalogImportRaw(body: unknown): Promise<PreviewResponse> {
  return fetchJson<PreviewResponse>("/api/v1/catalogs/glazing-types/import/preview", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function commitCatalogImport(token: string): Promise<CommitResponse> {
  return fetchJson<CommitResponse>("/api/v1/catalogs/glazing-types/import/commit", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}
