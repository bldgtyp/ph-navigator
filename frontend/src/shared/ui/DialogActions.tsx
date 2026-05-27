export function DialogActions({
  busy,
  error,
  submitLabel,
  onClose,
  onConfirm,
}: {
  busy: boolean;
  error: string | null;
  submitLabel: string;
  onClose: () => void;
  onConfirm?: () => void;
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
          disabled={busy}
          onClick={onConfirm}
        >
          {submitLabel}
        </button>
      </div>
    </>
  );
}
