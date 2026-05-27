import { FormEvent, useState } from "react";
import { DialogActions } from "../../../../shared/ui/DialogActions";
import { ModalDialog } from "../../../../shared/ui/ModalDialog";
import type { AssemblyType } from "../../types";

const ASSEMBLY_TYPES: AssemblyType[] = ["wall", "floor", "roof", "other"];

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
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(name.trim(), type);
  }
  return (
    <ModalDialog title={title} titleId="envelope-assembly-dialog-title" onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        {hideName ? null : (
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.currentTarget.value)} />
          </label>
        )}
        {hideType ? null : (
          <label>
            Type
            <select
              value={type}
              onChange={(event) => setType(event.currentTarget.value as AssemblyType)}
            >
              {ASSEMBLY_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        )}
        <DialogActions busy={busy} error={error} submitLabel="Apply" onClose={onClose} />
      </form>
    </ModalDialog>
  );
}
