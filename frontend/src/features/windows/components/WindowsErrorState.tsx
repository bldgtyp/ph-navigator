import { errorMessage } from "../../../shared/lib/errors";
import { projectDownloadUrl } from "../../project_document/api";
import { isInvalidProjectDocumentError } from "../../project_document/lib";

export function WindowsErrorState({
  error,
  projectId,
  activeVersionId,
}: {
  error: unknown;
  projectId: string;
  activeVersionId: string | null;
}) {
  const invalidDocument = isInvalidProjectDocumentError(error);
  return (
    <section className="tab-panel" aria-labelledby="windows-title">
      <h2 id="windows-title">Windows</h2>
      <p role="alert">{errorMessage(error, "Could not load window types.")}</p>
      {invalidDocument && activeVersionId ? (
        <p className="form-note">
          Editing is disabled for this version.{" "}
          <a href={projectDownloadUrl(projectId, activeVersionId)}>Download raw project JSON</a>
        </p>
      ) : null}
    </section>
  );
}
