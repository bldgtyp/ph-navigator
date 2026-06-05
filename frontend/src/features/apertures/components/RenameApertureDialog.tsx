import { useEffect, useId, useRef, useState } from "react";
import { DialogActions } from "../../../shared/ui/DialogActions";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { nameCollides } from "../lib";
import type { ApertureTypeEntry } from "../types";

export function RenameApertureDialog({
  aperture,
  allApertures,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  aperture: ApertureTypeEntry;
  allApertures: ApertureTypeEntry[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (newName: string) => void;
}) {
  const titleId = useId();
  const [value, setValue] = useState(aperture.name);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const trimmed = value.trim();
  const collides = nameCollides(allApertures, trimmed, aperture.id);
  const unchanged = trimmed === aperture.name.trim();
  const isDisabled = trimmed.length === 0 || collides || unchanged;

  return (
    <ModalDialog title="Aperture Type Name" titleId={titleId} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!isDisabled) onSubmit(trimmed);
        }}
      >
        <label htmlFor={`${titleId}-input`}>Aperture Type Name</label>
        <input
          id={`${titleId}-input`}
          ref={inputRef}
          className="rename-aperture-dialog__input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoFocus
        />
        {collides ? (
          <p className="rename-aperture-dialog__helper" role="alert">
            An aperture type named &lsquo;{trimmed}&rsquo; already exists in this version.
          </p>
        ) : null}
        <DialogActions
          busy={busy || isDisabled}
          error={error}
          submitLabel="Save"
          onClose={onClose}
        />
      </form>
    </ModalDialog>
  );
}
