import * as AlertDialog from "@radix-ui/react-alert-dialog";

// Destructive-action confirm dialog for the toolbar row-delete gesture
// (Phase 2 §4.6). Default focus is Cancel — same pattern as the
// existing RoomModal delete confirm and matching US-Builder-Tables
// criterion 10 (no name retyping).
export type ConfirmRowDeleteDialogProps = {
  open: boolean;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmRowDeleteDialog({
  open,
  count,
  onCancel,
  onConfirm,
}: ConfirmRowDeleteDialogProps) {
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
          <AlertDialog.Title className="data-table-alert-title">
            {count === 1 ? "Delete 1 row?" : `Delete ${count} rows?`}
          </AlertDialog.Title>
          <AlertDialog.Description className="data-table-alert-description">
            This cannot be undone from a saved version. You can ⌘Z to restore within this session.
          </AlertDialog.Description>
          <div className="data-table-alert-actions">
            <AlertDialog.Cancel asChild>
              <button type="button" className="secondary-button" onClick={onCancel}>
                Cancel
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button type="button" className="danger-button" onClick={onConfirm}>
                Delete
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
