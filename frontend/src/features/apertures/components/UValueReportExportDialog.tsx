import { DialogActions } from "../../../shared/ui/DialogActions";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import type { ApertureUValueExportFormat } from "../hooks/useApertureUValueReportExport";

export function UValueReportExportDialog({
  format,
  hasUnsavedDraft,
  unfinishedCount,
  busy,
  onClose,
  onConfirm,
}: {
  format: ApertureUValueExportFormat;
  hasUnsavedDraft: boolean;
  unfinishedCount: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const formatLabel = format.toUpperCase();
  return (
    <ModalDialog
      id="aperture-u-value-export-dialog"
      title={`Review ${formatLabel} download`}
      titleId="aperture-u-value-export-title"
      onClose={onClose}
    >
      {hasUnsavedDraft ? (
        <p>
          Export uses the last saved version — your unsaved changes are not included. Save the
          version first if the file must match the current draft.
        </p>
      ) : null}
      {unfinishedCount > 0 ? (
        <p>
          The report contains {unfinishedCount} unfinished element
          {unfinishedCount === 1 ? "" : "s"}. Aperture U-w includes them as U = 0, and the file
          marks them <strong>UNFINISHED</strong>.
        </p>
      ) : null}
      <DialogActions
        busy={busy}
        error={null}
        submitLabel={`Download ${formatLabel}`}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    </ModalDialog>
  );
}
