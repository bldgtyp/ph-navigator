import { Link } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/errors";
import { formatProjectDate } from "../../../shared/lib/dates";
import { projectStatusPath } from "../lib";
import type { ProjectSummary } from "../types";

export function ProjectList({
  isLoading,
  error,
  projects,
}: {
  isLoading: boolean;
  error: unknown;
  projects: ProjectSummary[];
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
      <section className="empty-state" aria-label="Empty dashboard">
        <h2>No projects yet</h2>
        <p>Create the first PH-Navigator V2 project shell from this dashboard.</p>
      </section>
    );
  }

  return (
    <section className="project-list" aria-label="Projects">
      <div className="project-list-heading">
        <span>BT #</span>
        <span>Project</span>
        <span>Client</span>
        <span>Last saved</span>
      </div>
      {projects.map((project) => (
        <Link className="project-row" to={projectStatusPath(project.id)} key={project.id}>
          <span>{project.bt_number}</span>
          <strong>{project.name}</strong>
          <span>{project.client || "-"}</span>
          <span>{project.last_saved_at ? formatProjectDate(project.last_saved_at) : "-"}</span>
        </Link>
      ))}
    </section>
  );
}
