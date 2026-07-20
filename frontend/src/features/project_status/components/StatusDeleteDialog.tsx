import { DialogActions } from "../../../shared/ui/DialogActions";
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
        <DialogActions
          busy={isDeleting}
          error={error}
          submitLabel={isDeleting ? "Deleting…" : "Delete item"}
          onClose={onCancel}
          onConfirm={onConfirm}
          danger
        />
      </div>
    </ModalDialog>
  );
}
