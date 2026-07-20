import type { ReactNode } from "react";

export function DialogActions({
  busy,
  error,
  submitLabel,
  onClose,
  onConfirm,
  submitDisabled = false,
  danger = false,
  extraActions,
}: {
  busy: boolean;
  error: string | null;
  submitLabel: string;
  onClose: () => void;
  onConfirm?: () => void;
  submitDisabled?: boolean;
  // Destructive primary: renders the primary as `danger-button` (e.g. a
  // delete confirmation) instead of the accent `primary-button`.
  danger?: boolean;
  // Optional secondary/tertiary actions (e.g. "Save As…", "Discard draft")
  // placed between Cancel (left) and the primary (right). The Cancel-left /
  // primary-right anchors stay fixed so every footer reads the same way.
  extraActions?: ReactNode;
}) {
  return (
    <>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onClose}>
          Cancel
        </button>
        {extraActions ? <span className="modal-actions-extra">{extraActions}</span> : null}
        <button
          type={onConfirm ? "button" : "submit"}
          className={danger ? "danger-button" : "primary-button"}
          disabled={busy || submitDisabled}
          onClick={onConfirm}
        >
          {submitLabel}
        </button>
      </div>
    </>
  );
}
