import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { ReactNode } from "react";

// Default focus lands on Cancel — matches the existing RoomModal
// delete confirm and US-Builder-Tables criterion 10 (no name retype).
export type ConfirmDestructiveDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmDisabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children?: ReactNode;
};

export function ConfirmDestructiveDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmDisabled = false,
  onCancel,
  onConfirm,
  children,
}: ConfirmDestructiveDialogProps) {
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="data-table-alert-overlay" />
        <AlertDialog.Content className="data-table-alert-content">
          <AlertDialog.Title className="data-table-alert-title">{title}</AlertDialog.Title>
          <AlertDialog.Description className="data-table-alert-description">
            {description}
          </AlertDialog.Description>
          {children}
          <div className="data-table-alert-actions">
            <AlertDialog.Cancel asChild>
              <button type="button" className="secondary-button" onClick={onCancel}>
                Cancel
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                type="button"
                className="danger-button"
                onClick={onConfirm}
                disabled={confirmDisabled}
              >
                {confirmLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
