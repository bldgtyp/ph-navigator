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

export function isVersionStaleError(error: unknown): boolean {
  return isDocumentWorkflowError(error, PROJECT_DOCUMENT_ERROR_CODES.versionEtagMismatch);
}

export function isVersionLockedError(error: unknown): boolean {
  return isDocumentWorkflowError(error, PROJECT_DOCUMENT_ERROR_CODES.versionLocked);
}

export function isInvalidProjectDocumentError(error: unknown): boolean {
  return isDocumentWorkflowError(error, PROJECT_DOCUMENT_ERROR_CODES.invalidProjectDocument);
}

function isDocumentWorkflowError(error: unknown, code: ProjectDocumentErrorCode): boolean {
  return error instanceof ApiRequestError && error.errorCode === code;
}

function localDraftVersionKey(projectId: string, versionId: string): string {
  return `${projectId}:${versionId}`;
}
