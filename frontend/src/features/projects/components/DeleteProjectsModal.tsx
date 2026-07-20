import { errorMessage } from "../../../shared/lib/errors";
import { DialogActions } from "../../../shared/ui/DialogActions";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import type { ProjectSummary } from "../types";

export function DeleteProjectsModal({
  projects,
  isPending,
  error,
  onCancel,
  onConfirm,
}: {
  projects: ProjectSummary[];
  isPending: boolean;
  error: unknown;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const title = projects.length === 1 ? "Delete project" : `Delete ${projects.length} projects`;
  const actionLabel = projects.length === 1 ? "Delete project" : "Delete projects";

  return (
    <ModalDialog title={title} titleId="delete-projects-title" onClose={onCancel}>
      <div className="confirmation-panel project-delete-confirmation">
        <p className="modal-subtitle">Can be restored for 90 days.</p>
        <ul className="project-delete-list" aria-label="Selected projects">
          {projects.map((project) => (
            <li key={project.id}>
              <span className="project-number">{project.bt_number}</span>
              <strong>{project.name}</strong>
            </li>
          ))}
        </ul>
        <DialogActions
          busy={isPending}
          error={error ? errorMessage(error, "Could not delete selected projects.") : null}
          submitLabel={isPending ? "Deleting…" : actionLabel}
          onClose={onCancel}
          onConfirm={onConfirm}
          danger
        />
      </div>
    </ModalDialog>
  );
}
