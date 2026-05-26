// Error / invalid-document fallback shown when the rooms-slice query
// fails. The "Download raw project JSON" escape hatch only renders
// when the failure is an `invalid_project_document` schema error
// (the version is unreadable but still downloadable).

import { errorMessage } from "../../../shared/lib/errors";
import { projectDownloadUrl } from "../../project_document/api";
import type { ProjectDetail } from "../../projects/types";
import { isInvalidProjectDocumentError } from "../lib";

export function EquipmentTabError({ project, error }: { project: ProjectDetail; error: unknown }) {
  const invalidDocument = isInvalidProjectDocumentError(error);
  const activeVersionId = project.active_version_id;
  return (
    <section className="tab-panel" aria-label="Equipment">
      <p role="alert">{errorMessage(error, "Could not load rooms.")}</p>
      {invalidDocument && activeVersionId ? (
        <p className="form-note">
          Editing is disabled for this version.{" "}
          <a href={projectDownloadUrl(project.id, activeVersionId)}>Download raw project JSON</a>
        </p>
      ) : null}
    </section>
  );
}
