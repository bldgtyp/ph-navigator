// Click-to-edit dimension label. Used by both the horizontal and vertical
// dimension strips. Read-mode renders the formatted value; edit-mode
// swaps in an inline input with a right-side delete icon. The input
// full-selects on entry, commits on Enter or blur, and cancels on Escape.
//
// Read-only (locked version / Viewer access) hides the input affordance
// and the delete button — the label becomes a static span.

import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";
import { Trash2 } from "lucide-react";
import type { DisplayFormat, UnitSystem } from "../../../lib/units/length/types";
import { useDimensionDraft, type DimensionDraftCommit } from "../hooks/useDimensionDraft";

export type DimensionLabelProps = {
  axis: "horizontal" | "vertical";
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
  axis,
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
  const inputCharacterCount = Math.max(6, draft.draft.length + 1);
  const inputWrapStyle = {
    "--aperture-dim-input-ch": inputCharacterCount,
  } as CSSProperties;

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
      <div
        className={`aperture-dim-label aperture-dim-label--${axis} aperture-dim-label--editing dimension-chrome-cell dimension-chrome-cell--${axis}`}
        style={style}
      >
        <label
          className="aperture-dim-label__input-wrap"
          data-testid={`${testIdPrefix}-editor`}
          style={inputWrapStyle}
        >
          <span className="sr-only">{ariaLabel}</span>
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
          <button
            type="button"
            className="dimension-chrome-delete-button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onDelete}
            disabled={!canDelete}
            title={canDelete ? "Delete" : (deleteDisabledReason ?? undefined)}
            data-testid={`${testIdPrefix}-delete`}
            aria-label={canDelete ? `Delete ${ariaLabel}` : (deleteDisabledReason ?? "Delete")}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </label>
      </div>
    );
  }

  const handleStartEdit = () => {
    if (!canEdit) return;
    draft.startEditing();
  };

  return (
    <div
      className={`aperture-dim-label aperture-dim-label--${axis} dimension-chrome-cell dimension-chrome-cell--${axis}`}
      data-testid={testIdPrefix}
      data-readonly={canEdit ? undefined : "true"}
      style={style}
    >
      <button
        type="button"
        className="aperture-dim-label__value dimension-chrome-label-button"
        onClick={handleStartEdit}
        disabled={!canEdit}
        data-testid={`${testIdPrefix}-value`}
        aria-label={ariaLabel}
      >
        {draft.display}
      </button>
    </div>
  );
}
