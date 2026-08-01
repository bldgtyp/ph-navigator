import { Fragment } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/errors";
import { formatProjectDateTime, formatRelativeProjectDate } from "../../../shared/lib/dates";
import { projectStatusPath } from "../lib";
import type { ProjectSummary } from "../types";

export function ProjectList({
  isLoading,
  error,
  projects,
  grouped,
  onCreateProject,
  selectedProjectIds,
  selectableProjectIds,
  selectedCount,
  isDeleting,
  onToggleProject,
  onToggleAllProjects,
  onDeleteSelected,
}: {
  isLoading: boolean;
  error: unknown;
  projects: ProjectSummary[];
  grouped: boolean;
  onCreateProject: () => void;
  selectedProjectIds: Set<string>;
  selectableProjectIds: Set<string>;
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
    selectableProjectIds.size > 0 &&
    Array.from(selectableProjectIds).every((projectId) => selectedProjectIds.has(projectId));

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
        <span className="sr-only" id="project-delete-owner-only-description">
          Only the owner can delete this project
        </span>
        <div className="project-list-heading">
          <span className="project-select-cell">
            <input
              type="checkbox"
              aria-label="Select all projects"
              checked={allSelected}
              disabled={selectableProjectIds.size === 0}
              aria-describedby={
                selectableProjectIds.size === 0
                  ? "project-delete-owner-only-description"
                  : undefined
              }
              title={
                selectableProjectIds.size === 0
                  ? "Only the owner can delete these projects"
                  : undefined
              }
              onChange={(event) => onToggleAllProjects(event.currentTarget.checked)}
            />
          </span>
          <span>BT #</span>
          <span>Project</span>
          <span>Client</span>
          <span>Last modified</span>
        </div>
        {projects.map((project, index) => {
          const startsGroup = grouped && project.owner_id !== projects[index - 1]?.owner_id;
          const selectable = selectableProjectIds.has(project.id);
          return (
            <Fragment key={project.id}>
              {startsGroup ? (
                <OwnerGroupHeading project={project} count={projectGroupCount(projects, index)} />
              ) : null}
              <div className="project-row">
                <span className="project-select-cell">
                  <input
                    type="checkbox"
                    aria-label={`Select project ${project.bt_number} ${project.display_name}`}
                    checked={selectedProjectIds.has(project.id)}
                    disabled={!selectable}
                    aria-describedby={
                      !selectable ? "project-delete-owner-only-description" : undefined
                    }
                    title={!selectable ? "Only the owner can delete this project" : undefined}
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
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}

function OwnerGroupHeading({ project, count }: { project: ProjectSummary; count: number }) {
  const ownerName = project.owner_display_name ?? "Unknown owner";
  return (
    <div className="project-section-heading project-owner-heading">
      <div>
        <h3>{ownerName}</h3>
        <span>
          {count} {count === 1 ? "project" : "projects"}
        </span>
      </div>
    </div>
  );
}

function projectGroupCount(projects: ProjectSummary[], startIndex: number): number {
  const ownerId = projects[startIndex]?.owner_id;
  let endIndex = startIndex;
  while (projects[endIndex]?.owner_id === ownerId) endIndex += 1;
  return endIndex - startIndex;
}
