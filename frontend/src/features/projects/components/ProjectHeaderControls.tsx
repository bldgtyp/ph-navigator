import type { ProjectDetail } from "../types";

export function ProjectHeaderControls({ project }: { project: ProjectDetail }) {
  if (project.access_mode === "viewer") {
    return <div className="shell-controls viewer-controls">Edit controls hidden</div>;
  }

  return (
    <div className="shell-controls">
      <button type="button" className="secondary-button" disabled>
        {project.active_version?.name ?? "No version"}
      </button>
      <span className="save-state">Clean</span>
      <button type="button" disabled>
        Save
      </button>
      <button type="button" className="secondary-button" disabled aria-label="Project settings">
        ...
      </button>
    </div>
  );
}
