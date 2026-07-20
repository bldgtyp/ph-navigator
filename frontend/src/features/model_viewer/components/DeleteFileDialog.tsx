import { DialogActions } from "../../../shared/ui/DialogActions";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import type { HbjsonFile } from "../types";

// US-VIEW-1 crit. 9 as amended by phase-01 §4.2: the airtightness-pin
// sentence is omitted until US-ENV-14 exists.
export function DeleteFileDialog({
  file,
  error,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  file: HbjsonFile;
  error: string | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalDialog
      title="Delete this HBJSON file?"
      titleId="model-file-delete-title"
      onClose={onCancel}
    >
      <div className="confirm-dialog-body">
        <p>
          '{file.display_name}' will be removed from the file list. The stored file follows the
          project's standard 90-day retention policy.
        </p>
        <DialogActions
          busy={isDeleting}
          error={error}
          submitLabel={isDeleting ? "Deleting…" : "Delete file"}
          onClose={onCancel}
          onConfirm={onConfirm}
          danger
        />
      </div>
    </ModalDialog>
  );
}
