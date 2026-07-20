import { DialogActions } from "../../../shared/ui/DialogActions";
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
          <DialogActions
            busy={busy}
            error={null}
            submitLabel="Discard draft"
            onClose={onCancel}
            onConfirm={onDiscard}
            danger
          />
        </div>
      </ModalDialog>
    );
  }

  if (confirmation.kind === "unlock") {
    return (
      <ModalDialog title="Unlock version?" titleId="unlock-version-title" onClose={onCancel}>
        <div className="confirmation-panel">
          <p>Unlocking allows direct edits and Save Version on this version.</p>
          <DialogActions
            busy={busy}
            error={null}
            submitLabel="Unlock version"
            onClose={onCancel}
            onConfirm={onUnlock}
          />
        </div>
      </ModalDialog>
    );
  }

  if (confirmation.kind === "switch") {
    const target = confirmation.target;
    return (
      <ModalDialog title="Uncommitted draft" titleId="switch-version-title" onClose={onCancel}>
        <div className="confirmation-panel">
          <p>
            This draft has changes that have not been committed to a version. Save them into a
            version or discard them before opening {target.name}.
          </p>
          <DialogActions
            busy={busy}
            error={null}
            submitLabel="Save then open"
            onClose={onCancel}
            onConfirm={() => onSwitchSave(target)}
            submitDisabled={isLocked}
            extraActions={
              <>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onSwitchSaveAs(target)}
                  disabled={busy}
                >
                  Save As… then open
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => onSwitchDiscard(target)}
                  disabled={busy}
                >
                  Discard changes
                </button>
              </>
            }
          />
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
          <StaleOrLockedActions
            busy={busy}
            onCancel={onCancel}
            onDiscard={onDiscard}
            onSaveAs={onSaveAs}
          />
        </div>
      </ModalDialog>
    );
  }

  return (
    <ModalDialog title="Version locked" titleId="locked-save-title" onClose={onCancel}>
      <div className="confirmation-panel">
        <p>This version was locked elsewhere. The draft is preserved; use Save As or discard it.</p>
        <StaleOrLockedActions
          busy={busy}
          onCancel={onCancel}
          onDiscard={onDiscard}
          onSaveAs={onSaveAs}
        />
      </div>
    </ModalDialog>
  );
}

// The stale-save and locked-save variants share an identical footer: Cancel,
// a destructive "Discard draft", and the "Save As" primary that preserves the
// draft as a new version.
function StaleOrLockedActions({
  busy,
  onCancel,
  onDiscard,
  onSaveAs,
}: {
  busy: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onSaveAs: () => void;
}) {
  return (
    <DialogActions
      busy={busy}
      error={null}
      submitLabel="Save As"
      onClose={onCancel}
      onConfirm={onSaveAs}
      extraActions={
        <button type="button" className="danger-button" onClick={onDiscard} disabled={busy}>
          Discard draft
        </button>
      }
    />
  );
}
