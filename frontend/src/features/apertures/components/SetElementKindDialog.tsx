import { DialogActions } from "../../../shared/ui/DialogActions";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { clearedAssignmentLabels } from "../empty-panel";
import type { ApertureElement } from "../types";

export function SetElementKindDialog({
  elements,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  elements: readonly ApertureElement[];
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (elements.length === 0) return null;
  const assignments = [...new Set(elements.flatMap(clearedAssignmentLabels))];
  const titleId = "set-aperture-elements-empty-title";
  const noun = elements.length === 1 ? "element" : `${elements.length} elements`;

  return (
    <ModalDialog title={`Make ${noun} Empty?`} titleId={titleId} onClose={onCancel}>
      <div className="modal-body">
        <p>
          This clears the assigned {formatList(assignments)}. Empty panels remain in the layout, but
          are excluded from the aperture.
        </p>
        <p>
          Recheck the surrounding frame assignments: edges beside an Empty panel are jamb, sill, or
          head conditions—not mullions.
        </p>
        <DialogActions
          busy={busy}
          error={error}
          submitLabel="Make Empty"
          onClose={onCancel}
          onConfirm={onConfirm}
          danger
        />
      </div>
    </ModalDialog>
  );
}

function formatList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "element data";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}
