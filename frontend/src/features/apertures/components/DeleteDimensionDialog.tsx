// Confirm-before-delete dialog for rows / columns that contain
// customized elements. Wraps the shared `ConfirmDestructiveDialog`
// with apertures-specific copy.

import { ConfirmDestructiveDialog } from "../../../shared/ui/data-table/components/ConfirmDestructiveDialog";

export type DeleteDimensionDialogProps = {
  open: boolean;
  axis: "row" | "column";
  index: number;
  customizedCount: number;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteDimensionDialog({
  open,
  axis,
  index,
  customizedCount,
  onCancel,
  onConfirm,
}: DeleteDimensionDialogProps) {
  const title = axis === "row" ? `Delete row ${index + 1}?` : `Delete column ${index + 1}?`;
  const noun = customizedCount === 1 ? "element" : "elements";
  const description =
    `${customizedCount} ${noun} with custom assignments will be removed. ` +
    "This can't be undone except by Discard Changes.";
  return (
    <ConfirmDestructiveDialog
      open={open}
      title={title}
      description={description}
      confirmLabel="Delete"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
