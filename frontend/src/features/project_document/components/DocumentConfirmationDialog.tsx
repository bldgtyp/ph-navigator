import { ModalDialog } from "../../../shared/ui/ModalDialog";
import type { ConfirmationDialog, ConfirmationDialogActions } from "../types/versionControls";

export function DocumentConfirmationDialog({
  confirmation,
  isLocked,
  busy,
  actions,
}: {
  confirmation: ConfirmationDialog;
  isLocked: boolean;
  busy: boolean;
  actions: ConfirmationDialogActions;
}) {
  const { onCancel, onDiscard, onUnlock, onSaveAs, onSwitchSave, onSwitchSaveAs, onSwitchDiscard } =
    actions;

  if (confirmation.kind === "discard") {
    return (
      <ModalDialog title="Discard draft?" titleId="discard-draft-title" onClose={onCancel}>
        <div className="confirmation-panel">
          <p>This deletes the server draft and reloads the saved version body.</p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="danger-button" onClick={onDiscard} disabled={busy}>
              Discard draft
            </button>
          </div>
        </div>
      </ModalDialog>
    );
  }

  if (confirmation.kind === "unlock") {
    return (
      <ModalDialog title="Unlock version?" titleId="unlock-version-title" onClose={onCancel}>
        <div className="confirmation-panel">
          <p>Unlocking allows direct edits and Save on this version.</p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" onClick={onUnlock} disabled={busy}>
              Unlock version
            </button>
          </div>
        </div>
      </ModalDialog>
    );
  }

  if (confirmation.kind === "switch") {
    const target = confirmation.target;
    return (
      <ModalDialog title="Unsaved draft" titleId="switch-version-title" onClose={onCancel}>
        <div className="confirmation-panel">
          <p>Save or discard this draft before opening {target.name}.</p>
          <div className="modal-actions modal-actions-stack">
            <button
              type="button"
              onClick={() => onSwitchSave(target)}
              disabled={busy || isLocked}
              title={isLocked ? "Locked versions cannot be saved directly." : undefined}
            >
              Save then open
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => onSwitchSaveAs(target)}
              disabled={busy}
            >
              Save As... then open
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={() => onSwitchDiscard(target)}
              disabled={busy}
            >
              Discard changes
            </button>
            <button type="button" className="secondary-button" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      </ModalDialog>
    );
  }

  if (confirmation.kind === "stale-save") {
    return (
      <ModalDialog title="Saved version changed" titleId="stale-save-title" onClose={onCancel}>
        <div className="confirmation-panel">
          <p>
            The saved version changed while this draft was open. Save As preserves this draft in a
            new version, or discard it and reload the current saved body.
          </p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onCancel}>
              Keep draft
            </button>
            <button type="button" className="secondary-button" onClick={onDiscard} disabled={busy}>
              Discard draft
            </button>
            <button type="button" onClick={onSaveAs} disabled={busy}>
              Save As
            </button>
          </div>
        </div>
      </ModalDialog>
    );
  }

  return (
    <ModalDialog title="Version locked" titleId="locked-save-title" onClose={onCancel}>
      <div className="confirmation-panel">
        <p>This version was locked elsewhere. The draft is preserved; use Save As or discard it.</p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Keep draft
          </button>
          <button type="button" className="secondary-button" onClick={onDiscard} disabled={busy}>
            Discard draft
          </button>
          <button type="button" onClick={onSaveAs} disabled={busy}>
            Save As
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}
