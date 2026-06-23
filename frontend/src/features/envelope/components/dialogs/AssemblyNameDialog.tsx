import { FormEvent, useEffect, useRef, useState } from "react";
import { DialogActions } from "../../../../shared/ui/DialogActions";
import { ModalDialog } from "../../../../shared/ui/ModalDialog";
import type { AssemblyType } from "../../types";

const ASSEMBLY_TYPES: Array<{ value: AssemblyType; label: string; description: string }> = [
  { value: "wall", label: "Wall", description: "Vertical opaque assemblies" },
  { value: "floor", label: "Floor", description: "Slabs and framed floors" },
  { value: "roof", label: "Roof", description: "Roofs and roof-ceilings" },
  { value: "other", label: "Other", description: "Special envelope cases" },
];

export function AssemblyNameDialog({
  title,
  initialName,
  initialType,
  hideName,
  hideType,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  title: string;
  initialName: string;
  initialType: AssemblyType;
  hideName?: boolean;
  hideType?: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (name: string, type: AssemblyType) => void;
}) {
  const [name, setName] = useState(initialName);
  const [type, setType] = useState<AssemblyType>(initialType);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const canSubmit = hideName || name.trim().length > 0;

  useEffect(() => {
    if (hideName) return;
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [hideName]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit(name.trim(), type);
  }

  return (
    <ModalDialog
      id="envelope-assembly-dialog"
      title={title}
      titleId="envelope-assembly-dialog-title"
      onClose={onClose}
    >
      <form className="envelope-assembly-dialog-form" onSubmit={submit}>
        {hideName ? null : (
          <label className="envelope-assembly-dialog-field">
            <span>Name</span>
            <input
              ref={nameInputRef}
              value={name}
              required
              autoComplete="off"
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </label>
        )}
        {hideType ? null : (
          <fieldset className="envelope-assembly-type-field">
            <legend>Type</legend>
            <div className="envelope-assembly-type-options">
              {ASSEMBLY_TYPES.map((option) => (
                <label
                  key={option.value}
                  className="envelope-assembly-type-option"
                  data-selected={type === option.value || undefined}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="assembly-type"
                    value={option.value}
                    checked={type === option.value}
                    onChange={() => setType(option.value)}
                  />
                  <span className="envelope-assembly-type-option-label">{option.label}</span>
                  <span className="envelope-assembly-type-option-description">
                    {option.description}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <DialogActions
          busy={busy}
          error={error}
          submitLabel={hideName || hideType ? "Apply" : "Create assembly"}
          submitDisabled={!canSubmit}
          onClose={onClose}
        />
      </form>
    </ModalDialog>
  );
}
