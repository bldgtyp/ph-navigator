import { ModalDialog } from "../../../../shared/ui/ModalDialog";
import { ConfirmDestructiveDialog } from "../../../../shared/ui/data-table";
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
    <ConfirmDestructiveDialog
      open
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      confirmDisabled={isConfirming}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <CascadeReferenceList affected={affected} />
    </ConfirmDestructiveDialog>
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
    <ModalDialog
      title={title}
      titleId="hp-cascade-blocked-title"
      onClose={onClose}
      dismissOnBackdrop
    >
      <div className="project-form table-row-modal-form">
        <p className="form-error" role="alert">
          {message}
        </p>
        <CascadeReferenceList affected={affected} />
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}

function CascadeReferenceList({ affected }: { affected: CascadeReference[] }) {
  return (
    <ul className="hp-cascade-list">
      {affected.map((item) => (
        <li key={`${item.table}:${item.row_id}`}>
          <strong>{item.tag || item.row_id}</strong>
          <span className="hp-cascade-meta"> — {item.table}</span>
        </li>
      ))}
    </ul>
  );
}
