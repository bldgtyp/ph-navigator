import { ApiRequestError } from "../../shared/api/client";
import type { ProjectDocumentReadSafeEnvelope } from "./types";

const PROJECT_DOCUMENT_ERROR_CODES = {
  draftEtagMismatch: "draft_etag_mismatch",
  versionEtagMismatch: "version_etag_mismatch",
  versionLocked: "version_locked",
  invalidProjectDocument: "invalid_project_document",
} as const;

type ProjectDocumentErrorCode =
  (typeof PROJECT_DOCUMENT_ERROR_CODES)[keyof typeof PROJECT_DOCUMENT_ERROR_CODES];

const locallyTouchedDraftEtagsByVersion = new Map<string, string>();

export function isReadSafeProjectDocument(
  payload: unknown,
): payload is ProjectDocumentReadSafeEnvelope {
  return (
    Boolean(payload) &&
    typeof payload === "object" &&
    (payload as { schema_version_unsupported?: unknown }).schema_version_unsupported === true
  );
}

export function markLocalDraftTouched(
  projectId: string,
  versionId: string,
  draftEtag: string | null,
) {
  if (!draftEtag) return;
  locallyTouchedDraftEtagsByVersion.set(localDraftVersionKey(projectId, versionId), draftEtag);
}

export function wasLocalDraftTouched(
  projectId: string,
  versionId: string,
  draftEtag: string | null,
): boolean {
  return Boolean(
    draftEtag &&
    locallyTouchedDraftEtagsByVersion.get(localDraftVersionKey(projectId, versionId)) === draftEtag,
  );
}

export function isDraftStaleError(error: unknown): boolean {
  return isDocumentWorkflowError(error, PROJECT_DOCUMENT_ERROR_CODES.draftEtagMismatch);
}

export type DraftConflictCause = "draft-etag" | "version-etag" | null;

export function classifyDraftConflict(error: unknown): DraftConflictCause {
  if (isDraftStaleError(error)) return "draft-etag";
  if (isVersionStaleError(error)) return "version-etag";
  return null;
}

export function draftConflictMessage(error: unknown, rejectedCount: number): string {
  const discarded = discardedWritesMessage(rejectedCount);
  return classifyDraftConflict(error) === "version-etag"
    ? `The saved version changed outside this view. Reloaded the latest version; ${discarded}`
    : `The draft changed outside this view (another tab, editor, or agent). Reloaded the latest draft; ${discarded}`;
}

export function discardedWritesMessage(rejectedCount: number): string {
  return `${rejectedCount} unsaved ${rejectedCount === 1 ? "change was" : "changes were"} discarded.`;
}

export function isVersionStaleError(error: unknown): boolean {
  return isDocumentWorkflowError(error, PROJECT_DOCUMENT_ERROR_CODES.versionEtagMismatch);
}

export function isVersionLockedError(error: unknown): boolean {
  return isDocumentWorkflowError(error, PROJECT_DOCUMENT_ERROR_CODES.versionLocked);
}

export function isInvalidProjectDocumentError(error: unknown): boolean {
  return isDocumentWorkflowError(error, PROJECT_DOCUMENT_ERROR_CODES.invalidProjectDocument);
}

export function draftLooksRecovered(lastPatchedAt: string | null): boolean {
  if (!lastPatchedAt) return true;
  // Draft writes can land before the summary refetch observes their ETag.
  // Treat very recent patches as active-session work, not crash recovery.
  return Date.now() - Date.parse(lastPatchedAt) > 5_000;
}

function isDocumentWorkflowError(error: unknown, code: ProjectDocumentErrorCode): boolean {
  return error instanceof ApiRequestError && error.errorCode === code;
}

function localDraftVersionKey(projectId: string, versionId: string): string {
  return `${projectId}:${versionId}`;
}
