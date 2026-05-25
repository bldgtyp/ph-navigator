import { ApiRequestError } from "../../../api/client";
import { errorMessage } from "../../../lib/errors";

export function schemaMutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) {
    if (error.errorCode === "custom_field_duplicate_name") {
      const colliding =
        typeof error.details.field_name === "string" ? error.details.field_name : null;
      return colliding
        ? `A field named "${colliding}" already exists in this table.`
        : "A field with that name already exists in this table.";
    }
    if (error.errorCode === "custom_field_stale_schema_fingerprint") {
      return "Someone else added or changed a field on this table. Refresh and try again.";
    }
    if (error.errorCode === "version_locked") {
      return "This version is locked. Save As to start an editable copy and try again.";
    }
  }
  return errorMessage(error, fallback);
}
