import { DialogActions } from "../../../shared/ui/DialogActions";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import type { PhppExportReason, PhppPreflightItem } from "../types";

const PHPP_EXPORT_REASON_LABELS: Record<PhppExportReason, string> = {
  too_many_layers: "more than 8 layers",
  too_many_pathways: "more than 3 heat-flow pathways",
  incomplete_materials: "missing materials or conductivities",
};

function reasonLabel(reason: PhppExportReason | null): string {
  return reason ? PHPP_EXPORT_REASON_LABELS[reason] : "cannot be represented in PHPP";
}

/**
 * Confirm/cancel modal shown before a PHPP export when some assemblies are not
 * exportable (PRD §9). The blocked assemblies are written as one-line error
 * CSVs inside the ZIP rather than dropped, so the user can still proceed.
 */
export function PhppExportWarningDialog({
  blocked,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  blocked: PhppPreflightItem[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalDialog
      id="phpp-export-warning-dialog"
      title="Some assemblies can't be exported to PHPP"
      titleId="phpp-export-warning-title"
      onClose={onClose}
    >
      <p>
        These assemblies will be included as a short note explaining why, instead of a U-Values
        block. Everything else exports normally.
      </p>
      <ul className="phpp-export-warning-list">
        {blocked.map((item) => (
          <li key={item.id}>
            <strong>{item.name}</strong> — {reasonLabel(item.reason)}
          </li>
        ))}
      </ul>
      <DialogActions
        busy={busy}
        error={error}
        submitLabel="Download anyway"
        onClose={onClose}
        onConfirm={onConfirm}
      />
    </ModalDialog>
  );
}
