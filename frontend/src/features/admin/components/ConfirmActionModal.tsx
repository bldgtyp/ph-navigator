import { errorMessage } from "../../../shared/lib/errors";
import { DialogActions } from "../../../shared/ui/DialogActions";
import { ModalDialog } from "../../../shared/ui/ModalDialog";

/**
 * Generic confirmation for a single sensitive account action
 * (deactivate/reactivate/grant/revoke). The parent owns the mutation and passes
 * its pending/error state in, so every confirm dialog behaves identically.
 */
export function ConfirmActionModal({
  title,
  message,
  confirmLabel,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  busy: boolean;
  error: unknown;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ModalDialog title={title} titleId="confirm-action-title" onClose={onClose}>
      <div className="modal-body admin-form">
        <p>{message}</p>
        <DialogActions
          busy={busy}
          error={error ? errorMessage(error, "Could not complete the action.") : null}
          submitLabel={busy ? "Working…" : confirmLabel}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      </div>
    </ModalDialog>
  );
}
