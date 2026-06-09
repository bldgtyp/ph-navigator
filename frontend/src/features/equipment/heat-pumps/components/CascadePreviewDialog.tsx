import { ModalDialog } from "../../../../shared/ui/ModalDialog";
import type { CascadeReference } from "../types";

export function CascadePreviewDialog({
  title,
  description,
  affected,
  confirmLabel,
  onConfirm,
  onCancel,
  isConfirming,
}: {
  title: string;
  description: string;
  affected: CascadeReference[];
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming: boolean;
}) {
  return (
    <ModalDialog title={title} titleId="hp-cascade-preview-title" onClose={onCancel}>
      <div className="project-form hp-modal-form">
        <p>{description}</p>
        <ul className="hp-cascade-list">
          {affected.map((item) => (
            <li key={`${item.table}:${item.row_id}`}>
              <strong>{item.tag || item.row_id}</strong>
              <span className="hp-cascade-meta"> — {item.table}</span>
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="danger-button"
            onClick={onConfirm}
            disabled={isConfirming}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}

export function BlockedDeleteDialog({
  title,
  message,
  affected,
  onClose,
}: {
  title: string;
  message: string;
  affected: CascadeReference[];
  onClose: () => void;
}) {
  return (
    <ModalDialog title={title} titleId="hp-cascade-blocked-title" onClose={onClose}>
      <div className="project-form hp-modal-form">
        <p className="form-error" role="alert">
          {message}
        </p>
        <ul className="hp-cascade-list">
          {affected.map((item) => (
            <li key={`${item.table}:${item.row_id}`}>
              <strong>{item.tag || item.row_id}</strong>
              <span className="hp-cascade-meta"> — {item.table}</span>
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}
