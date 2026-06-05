import { useEffect, type ReactNode } from "react";

export function ModalDialog({
  title,
  titleId,
  onClose,
  children,
  headerAccessory,
  showHeaderClose = true,
}: {
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
      onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
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
