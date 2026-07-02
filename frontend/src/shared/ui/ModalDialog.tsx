import { useEffect, type ReactNode } from "react";

export function ModalDialog({
  id,
  title,
  titleId,
  onClose,
  children,
  headerAccessory,
  showHeaderClose = true,
}: {
  id?: string;
  title: string;
  titleId: string;
  onClose: () => void;
  children: ReactNode;
  headerAccessory?: ReactNode;
  showHeaderClose?: boolean;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      event.preventDefault();
      // The dialog consumes the Escape that closes it — this listener is on
      // `document`, so stopping here keeps window-level Escape handlers
      // (e.g. the model viewer's deselect) from also acting. Other keys are
      // not intercepted; page hotkey owners must guard themselves while a
      // modal is open (see ModelViewerStage's keydown guard).
      event.stopPropagation();
      onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        id={id}
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <div className="modal-header-actions">
            {headerAccessory}
            {showHeaderClose ? (
              <button type="button" className="text-button" onClick={onClose}>
                Close
              </button>
            ) : null}
          </div>
        </div>
        {children}
      </section>
    </div>
  );
}
