import type { ProjectDocumentReadSafeEnvelope } from "./types";

export function isReadSafeProjectDocument(
  payload: unknown,
): payload is ProjectDocumentReadSafeEnvelope {
  return (
    Boolean(payload) &&
    typeof payload === "object" &&
    (payload as { schema_version_unsupported?: unknown }).schema_version_unsupported === true
  );
}
