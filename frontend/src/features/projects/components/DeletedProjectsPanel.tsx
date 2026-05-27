import { errorMessage } from "../../../shared/lib/errors";
import { formatProjectDateTime } from "../../../shared/lib/dates";
import type { ProjectDeletedSummary } from "../types";

export function DeletedProjectsPanel({
  isLoading,
  error,
  projects,
  restoreError,
  restoringProjectId,
  onRestoreProject,
}: {
  isLoading: boolean;
  error: unknown;
  projects: ProjectDeletedSummary[];
  restoreError: unknown;
  restoringProjectId: string | null;
  onRestoreProject: (projectId: string) => void;
}) {
  return (
    <section aria-labelledby="deleted-projects-title">
      <div className="project-section-heading">
        <div>
          <h2 id="deleted-projects-title">Recently deleted</h2>
          <span>
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </span>
        </div>
      </div>
      <div className="deleted-project-list">
        {isLoading ? <p className="deleted-project-empty">Loading deleted projects...</p> : null}
        {error ? (
          <p className="form-error" role="alert">
            {errorMessage(error, "Could not load deleted projects.")}
          </p>
        ) : null}
        {!isLoading && !error && projects.length === 0 ? (
          <p className="deleted-project-empty">No deleted projects.</p>
        ) : null}
        {projects.map((project) => {
          const isRestoring = restoringProjectId === project.id;
          return (
            <div className="deleted-project-row" key={project.id}>
              <div>
                <span className="project-number">{project.bt_number}</span>
                <strong>{project.name}</strong>
              </div>
              <span>
                <span className="deleted-project-label">Deleted</span>
                {project.deleted_at ? formatProjectDateTime(project.deleted_at) : "-"}
              </span>
              <span>
                <span className="deleted-project-label">Hard delete after</span>
                {project.hard_delete_after ? formatProjectDateTime(project.hard_delete_after) : "-"}
              </span>
              <button
                type="button"
                className="secondary-button"
                disabled={isRestoring}
                onClick={() => onRestoreProject(project.id)}
              >
                {isRestoring ? "Restoring..." : "Restore"}
              </button>
            </div>
          );
        })}
        {restoreError ? (
          <p className="form-error" role="alert">
            {errorMessage(restoreError, "Could not restore project.")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
