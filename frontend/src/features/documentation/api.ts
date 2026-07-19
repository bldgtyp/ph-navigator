import { fetchJson } from "../../shared/api/client";
import { draftWriteHeaders, type BaseTableSlice } from "../project_document/table-slice";
import type { ProjectDocumentationSummary } from "./types";

export type DocumentationDraftTableSlice = BaseTableSlice & Record<string, unknown>;

export type DocumentationDraftWriteResult = {
  version_id: string;
  draft_etag: string | null;
};

export async function fetchDocumentationSummary(
  projectId: string,
  versionId: string,
  accessMode: "editor" | "viewer",
): Promise<ProjectDocumentationSummary> {
  const source = accessMode === "editor" ? "draft" : "document";
  return fetchJson<ProjectDocumentationSummary>(
    `/api/v1/projects/${projectId}/versions/${versionId}/${source}/documentation-summary`,
  );
}

export async function fetchDocumentationDraftTable(
  projectId: string,
  versionId: string,
  tableName: string,
): Promise<DocumentationDraftTableSlice> {
  return fetchJson<DocumentationDraftTableSlice>(
    `/api/v1/projects/${projectId}/versions/${versionId}/draft/tables/${tableName}`,
  );
}

export async function replaceDocumentationDraftTable(
  projectId: string,
  versionId: string,
  tableName: string,
  current: BaseTableSlice,
  payload: Record<string, unknown>,
): Promise<DocumentationDraftTableSlice> {
  return fetchJson<DocumentationDraftTableSlice>(
    `/api/v1/projects/${projectId}/versions/${versionId}/draft/tables/${tableName}`,
    {
      method: "PUT",
      headers: draftWriteHeaders(current),
      body: JSON.stringify(payload),
    },
  );
}

export async function applyDocumentationEnvelopeCommand(
  projectId: string,
  versionId: string,
  current: BaseTableSlice,
  command: Record<string, unknown>,
): Promise<DocumentationDraftWriteResult> {
  return fetchJson<DocumentationDraftWriteResult>(
    `/api/v1/projects/${projectId}/versions/${versionId}/draft/envelope/commands`,
    {
      method: "POST",
      headers: draftWriteHeaders(current),
      body: JSON.stringify({ command }),
    },
  );
}
