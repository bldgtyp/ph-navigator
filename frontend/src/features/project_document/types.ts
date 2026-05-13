import type { ProjectVersion } from "../projects/types";

export type ProjectDocumentReadSafeEnvelope = {
  project_id: string;
  version_id: string;
  source: "version" | "draft";
  schema_version: number | null;
  current_schema_version: number;
  schema_version_unsupported: true;
  error_code: "schema_migration_failed" | "schema_validation_failed_after_migration";
  message: string;
  request_id: string;
  validation_errors: string[];
  body: unknown;
};

export type ProjectDraftSummary = {
  project_id: string;
  version_id: string;
  source: "version" | "draft";
  version_etag: string;
  draft_etag: string | null;
  dirty_tables: string[];
  last_patched_at: string | null;
  is_locked: boolean;
  can_edit: boolean;
};

export type ProjectDraftStatus = ProjectDraftSummary | ProjectDocumentReadSafeEnvelope;
export type ProjectDocumentResponse = Record<string, unknown> | ProjectDocumentReadSafeEnvelope;

export type SaveDraftResponse = {
  project_id: string;
  version: ProjectVersion;
  version_etag: string;
};

export type SaveAsPayload = {
  name: string;
  kind: ProjectVersion["kind"];
  locked: boolean;
};

export type DiffSummary = {
  project_id: string;
  from_version_id: string;
  to_version_id: string;
  tables: Array<{
    table: string;
    change_count: number;
    changed_paths: string[];
  }>;
};
