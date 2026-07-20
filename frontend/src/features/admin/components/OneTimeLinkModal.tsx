import { useState } from "react";
import { ModalDialog } from "../../../shared/ui/ModalDialog";

/**
 * Shows a one-time invite/reset link exactly once for manual delivery. The raw
 * link is never persisted or re-fetched — once this modal is dismissed it is
 * gone, matching the backend contract (raw links live only in the create
 * response).
 */
export function OneTimeLinkModal({
  title,
  description,
  link,
  onClose,
}: {
  title: string;
  description: string;
  link: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <ModalDialog title={title} titleId="one-time-link-title" onClose={onClose}>
      <div className="modal-body admin-link-modal">
        <p>{description}</p>
        <p className="admin-link-warning">
          This link is shown once and cannot be retrieved later. Copy it now and deliver it
          directly.
        </p>
        <div className="admin-link-row">
          <input
            className="admin-link-input"
            type="text"
            readOnly
            value={link}
            aria-label="One-time link"
            onFocus={(event) => event.currentTarget.select()}
          />
          <button type="button" className="secondary-button" onClick={handleCopy}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}
