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
}: {
  isLoading: boolean;
  error: unknown;
  projects: ProjectSummary[];
  onCreateProject: () => void;
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
          New project
        </button>
      </section>
    );
  }

  const renderedAt = new Date();

  return (
    <div className="dashboard-sections">
      <section aria-labelledby="all-projects-title">
        <div className="project-section-heading">
          <h2 id="all-projects-title">All projects</h2>
          <span>
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </span>
        </div>
        <div className="project-list" aria-label="All projects">
          <div className="project-list-heading">
            <span>BT #</span>
            <span>Project</span>
            <span>Client</span>
            <span>Last modified</span>
          </div>
          {projects.map((project) => (
            <Link className="project-row" to={projectStatusPath(project.id)} key={project.id}>
              <span className="project-number">{project.bt_number}</span>
              <strong>{project.name}</strong>
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
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
