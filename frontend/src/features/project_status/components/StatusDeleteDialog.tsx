import { ModalDialog } from "../../../shared/ui/ModalDialog";
import type { StatusItem } from "../types";

export function StatusDeleteDialog({
  item,
  error,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  item: StatusItem;
  error: string | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalDialog title="Delete status item" titleId="status-delete-title" onClose={onCancel}>
      <div className="confirm-dialog-body">
        <p>
          Delete <strong>{item.title}</strong>? This removes it from the shared project status
          timeline.
        </p>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="danger-button" disabled={isDeleting} onClick={onConfirm}>
            {isDeleting ? "Deleting..." : "Delete item"}
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}
