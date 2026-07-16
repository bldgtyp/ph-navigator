import { Link } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/errors";
import { formatProjectDateTime, formatRelativeProjectDate } from "../../../shared/lib/dates";
import { projectStatusPath } from "../lib";
import type { ProjectSummary } from "../types";

export function ProjectList({
  isLoading,
  error,
  projects,
  onCreateProject,
  selectedProjectIds,
  selectedCount,
  isDeleting,
  onToggleProject,
  onToggleAllProjects,
  onDeleteSelected,
}: {
  isLoading: boolean;
  error: unknown;
  projects: ProjectSummary[];
  onCreateProject: () => void;
  selectedProjectIds: Set<string>;
  selectedCount: number;
  isDeleting: boolean;
  onToggleProject: (projectId: string, selected: boolean) => void;
  onToggleAllProjects: (selected: boolean) => void;
  onDeleteSelected: () => void;
}) {
  if (isLoading) {
    return <section className="empty-state">Loading projects...</section>;
  }

  if (error) {
    return (
      <section className="empty-state" role="alert">
        {errorMessage(error, "Could not load projects.")}
      </section>
    );
  }

  if (projects.length === 0) {
    return (
      <section className="empty-state" aria-labelledby="empty-dashboard-title">
        <h2 id="empty-dashboard-title">No projects yet</h2>
        <p>Create the first PH-Navigator V2 project shell from this dashboard.</p>
        <button type="button" onClick={onCreateProject}>
          Add New Project +
        </button>
      </section>
    );
  }

  const renderedAt = new Date();
  const allSelected =
    projects.length > 0 && projects.every((project) => selectedProjectIds.has(project.id));

  return (
    <section aria-labelledby="all-projects-title">
      <div className="project-section-heading">
        <div>
          <h2 id="all-projects-title">All projects</h2>
          <span>
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </span>
        </div>
      </div>
      {selectedCount > 0 ? (
        <div className="project-bulk-actions">
          <button
            type="button"
            className="danger-button"
            disabled={isDeleting}
            onClick={onDeleteSelected}
          >
            {isDeleting ? "Deleting..." : `Delete selected (${selectedCount})`}
          </button>
        </div>
      ) : null}
      <div className="project-list" aria-label="All projects">
        <div className="project-list-heading">
          <span className="project-select-cell">
            <input
              type="checkbox"
              aria-label="Select all projects"
              checked={allSelected}
              onChange={(event) => onToggleAllProjects(event.currentTarget.checked)}
            />
          </span>
          <span>BT #</span>
          <span>Project</span>
          <span>Client</span>
          <span>Last modified</span>
        </div>
        {projects.map((project) => (
          <div className="project-row" key={project.id}>
            <span className="project-select-cell">
              <input
                type="checkbox"
                aria-label={`Select project ${project.bt_number} ${project.display_name}`}
                checked={selectedProjectIds.has(project.id)}
                onChange={(event) => onToggleProject(project.id, event.currentTarget.checked)}
              />
            </span>
            <span className="project-number">{project.bt_number}</span>
            <Link
              aria-label={`${project.bt_number} - ${project.display_name}`}
              className="project-name-link"
              to={projectStatusPath(project.id)}
            >
              <strong>{project.display_name}</strong>
            </Link>
            <span>{project.client || "-"}</span>
            <span
              title={
                project.last_saved_at ? formatProjectDateTime(project.last_saved_at) : undefined
              }
            >
              {project.last_saved_at
                ? formatRelativeProjectDate(project.last_saved_at, renderedAt)
                : "-"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
