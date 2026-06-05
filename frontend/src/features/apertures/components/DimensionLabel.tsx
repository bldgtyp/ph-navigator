// Click-to-edit dimension label. Used by both the horizontal and vertical
// dimension strips. Read-mode renders the formatted value with a hover-
// revealed `−` delete button; edit-mode swaps in an `<input>` with full-
// select on entry, commits on Enter or blur, cancels on Escape.
//
// Read-only (locked version / Viewer access) hides the input affordance
// and the delete button — the label becomes a static span.

import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";
import type { DisplayFormat, UnitSystem } from "../../../lib/units/length/types";
import { useDimensionDraft, type DimensionDraftCommit } from "../hooks/useDimensionDraft";

export type DimensionLabelProps = {
  mm: number;
  system: UnitSystem;
  format: DisplayFormat;
  canEdit: boolean;
  canDelete: boolean;
  deleteDisabledReason?: string | null;
  onCommit: (mm: number) => void;
  onDelete: () => void;
  style?: CSSProperties;
  ariaLabel: string;
  testIdPrefix: string;
};

export function DimensionLabel({
  mm,
  system,
  format,
  canEdit,
  canDelete,
  deleteDisabledReason,
  onCommit,
  onDelete,
  style,
  ariaLabel,
  testIdPrefix,
}: DimensionLabelProps) {
  const draft = useDimensionDraft({ initialMm: mm, system, format });
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!draft.editing) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [draft.editing]);

  const handleCommit = () => {
    const result: DimensionDraftCommit = draft.commit();
    if (result.ok) onCommit(result.mm);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleCommit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      draft.cancel();
    }
  };

  if (draft.editing && canEdit) {
    return (
      <div className="aperture-dim-label aperture-dim-label--editing" style={style}>
        <input
          ref={inputRef}
          className="aperture-dim-label__input"
          data-testid={`${testIdPrefix}-input`}
          data-error={draft.error ? "true" : undefined}
          value={draft.draft}
          onChange={(event) => draft.setDraft(event.target.value)}
          onBlur={handleCommit}
          onKeyDown={handleKeyDown}
          title={draft.error ?? undefined}
          aria-label={ariaLabel}
          aria-invalid={draft.error ? true : undefined}
        />
      </div>
    );
  }

  const handleStartEdit = () => {
    if (!canEdit) return;
    draft.startEditing();
  };

  return (
    <div
      className="aperture-dim-label"
      data-testid={testIdPrefix}
      data-readonly={canEdit ? undefined : "true"}
      style={style}
    >
      <button
        type="button"
        className="aperture-dim-label__value"
        onClick={handleStartEdit}
        disabled={!canEdit}
        data-testid={`${testIdPrefix}-value`}
        aria-label={ariaLabel}
      >
        {draft.display}
      </button>
      {canEdit ? (
        <button
          type="button"
          className="aperture-dim-label__delete"
          onClick={onDelete}
          disabled={!canDelete}
          title={canDelete ? "Delete" : (deleteDisabledReason ?? undefined)}
          data-testid={`${testIdPrefix}-delete`}
          aria-label={canDelete ? `Delete ${ariaLabel}` : (deleteDisabledReason ?? "Delete")}
        >
          −
        </button>
      ) : null}
    </div>
  );
}
