import { useEffect, type ReactNode } from "react";

export function ModalDialog({
  id,
  title,
  titleId,
  onClose,
  children,
  headerAccessory,
  showHeaderClose = false,
  dismissOnBackdrop = false,
  resizable = false,
}: {
  id?: string;
  title: string;
  titleId: string;
  onClose: () => void;
  children: ReactNode;
  headerAccessory?: ReactNode;
  // The modal contract makes footer `Cancel` the canonical dismiss, so the
  // top-right header "Close" is OFF by default. Read-only viewers with no
  // footer opt back in with `showHeaderClose` (it becomes their only dismiss).
  showHeaderClose?: boolean;
  // Backdrop-click dismiss is OFF by default so forms can't lose unsaved input
  // to a stray click. Read-only viewers opt in with `dismissOnBackdrop` where
  // click-away is the expected gesture.
  dismissOnBackdrop?: boolean;
  // Oversized, scrolling modals (tall forms, data-dense viewers) opt into the
  // lower-right resize grip via `.modal-panel--resizable`.
  resizable?: boolean;
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
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={
        dismissOnBackdrop
          ? (event) => {
              // Only a click on the backdrop itself dismisses; clicks that
              // bubble up from the panel/its contents must not.
              if (event.target === event.currentTarget) onClose();
            }
          : undefined
      }
    >
      <section
        id={id}
        className={resizable ? "modal-panel modal-panel--resizable" : "modal-panel"}
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
