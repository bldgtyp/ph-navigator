import { useId } from "react";
import { DialogActions } from "../../../shared/ui/DialogActions";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import type { ApertureTypeEntry } from "../types";

export function DeleteApertureDialog({
  aperture,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  aperture: ApertureTypeEntry;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  return (
    <ModalDialog title="Delete aperture type?" titleId={titleId} onClose={onClose}>
      <p>
        This will remove &lsquo;{aperture.name}&rsquo; and all its elements from this version. Save
        or Save As to persist. Cancel keeps it in your draft.
      </p>
      <DialogActions
        busy={busy}
        error={error}
        submitLabel="Delete"
        onClose={onClose}
        onConfirm={onConfirm}
      />
    </ModalDialog>
  );
}
