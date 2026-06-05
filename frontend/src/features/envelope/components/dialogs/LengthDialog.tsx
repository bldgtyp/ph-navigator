import { FormEvent } from "react";
import { DialogActions } from "../../../../shared/ui/DialogActions";
import { ModalDialog } from "../../../../shared/ui/ModalDialog";
import { useLengthDraft } from "../../hooks/useLengthDraft";
import { ModalUnitToggle } from "../ModalUnitToggle";
import { useUnitPreference } from "../../../../lib/units";

export function LengthDialog({
  dialogId = "envelope-length-dialog",
  title,
  label,
  initialValueMm,
  busy,
  error,
  showFieldLabel = true,
  onClose,
  onSubmit,
}: {
  dialogId?: string;
  title: string;
  label: string;
  initialValueMm: number;
  busy: boolean;
  error: string | null;
  showFieldLabel?: boolean;
  onClose: () => void;
  onSubmit: (valueMm: number) => void;
}) {
  const { unitSystem, setUnitSystem } = useUnitPreference();
  const length = useLengthDraft(initialValueMm, {
    followUnitPreference: true,
    unitLabelStyle: label === "Thickness" ? "long" : "short",
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    const valueMm = length.parsePositive(label);
    if (valueMm !== null) onSubmit(valueMm);
  }
  const titleId = `${dialogId}-title`;
  const fieldId = `${dialogId}-${label.toLowerCase()}-input`;

  return (
    <ModalDialog
      id={dialogId}
      title={title}
      titleId={titleId}
      onClose={onClose}
      headerAccessory={
        <>
          <ModalUnitToggle
            id={`${dialogId}-unit-toggle`}
            unitSystem={unitSystem}
            setUnitSystem={setUnitSystem}
          />
        </>
      }
      showHeaderClose={false}
    >
      <form id={`${dialogId}-form`} className="modal-form layer-thickness-form" onSubmit={submit}>
        <label className={showFieldLabel ? undefined : "sr-only"} htmlFor={fieldId}>
          {label} ({length.unitLabel})
        </label>
        <div className="length-dialog-input-row">
          <input
            id={fieldId}
            aria-label={`${label} (${length.unitLabel})`}
            value={length.draft}
            onChange={(event) => length.setDraft(event.currentTarget.value)}
          />
        </div>
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
