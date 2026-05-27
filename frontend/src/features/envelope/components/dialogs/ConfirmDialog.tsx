import { DialogActions } from "../../../../shared/ui/DialogActions";
import { ModalDialog } from "../../../../shared/ui/ModalDialog";

export function ConfirmDialog({
  title,
  message,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  title: string;
  message: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalDialog title={title} titleId="envelope-confirm-dialog-title" onClose={onClose}>
      <div className="modal-form">
        <p>{message}</p>
        <DialogActions
          busy={busy}
          error={error}
          submitLabel="Confirm"
          onClose={onClose}
          onConfirm={onConfirm}
        />
      </div>
    </ModalDialog>
  );
}
