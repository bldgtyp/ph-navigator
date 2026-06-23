export function DialogActions({
  busy,
  error,
  submitLabel,
  onClose,
  onConfirm,
  submitDisabled = false,
}: {
  busy: boolean;
  error: string | null;
  submitLabel: string;
  onClose: () => void;
  onConfirm?: () => void;
  submitDisabled?: boolean;
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
        <button
          type={onConfirm ? "button" : "submit"}
          className="primary-button"
          disabled={busy || submitDisabled}
          onClick={onConfirm}
        >
          {submitLabel}
        </button>
      </div>
    </>
  );
}
