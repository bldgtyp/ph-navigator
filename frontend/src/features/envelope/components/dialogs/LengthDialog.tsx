import { FormEvent } from "react";
import { DialogActions } from "../../../../shared/ui/DialogActions";
import { ModalDialog } from "../../../../shared/ui/ModalDialog";
import { useLengthDraft } from "../../hooks/useLengthDraft";
import { ModalUnitToggle } from "../ModalUnitToggle";
import { useUnitPreference } from "../../../../lib/units";

export function LengthDialog({
  title,
  label,
  initialValueMm,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  title: string;
  label: string;
  initialValueMm: number;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (valueMm: number) => void;
}) {
  const { unitSystem, setUnitSystem } = useUnitPreference();
  const length = useLengthDraft(initialValueMm);
  function submit(event: FormEvent) {
    event.preventDefault();
    const valueMm = length.parsePositive("Length");
    if (valueMm !== null) onSubmit(valueMm);
  }
  return (
    <ModalDialog title={title} titleId="envelope-length-dialog-title" onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <ModalUnitToggle unitSystem={unitSystem} setUnitSystem={setUnitSystem} />
        <label>
          {label} ({length.unitLabel})
          <input
            value={length.draft}
            onChange={(event) => length.setDraft(event.currentTarget.value)}
          />
        </label>
        <DialogActions
          busy={busy}
          error={length.error ?? error}
          submitLabel="Apply"
          onClose={onClose}
        />
      </form>
    </ModalDialog>
  );
}
