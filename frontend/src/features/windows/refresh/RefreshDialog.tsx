import { useMemo, useState } from "react";
import { formatClipboardValue } from "../../../shared/ui/data-table/lib";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import type { FrameRef, GlazingRef } from "../types";
import { applyRefreshSelection, canApplyRefresh, defaultRefreshSelection } from "./lib";
import type { RefreshFieldChoice, RefreshSelection, RefreshSlotReport } from "./types";

export function RefreshDialog({
  slot,
  refValue,
  busy,
  onCancel,
  onApply,
}: {
  slot: RefreshSlotReport;
  refValue: FrameRef | GlazingRef;
  busy: boolean;
  onCancel: () => void;
  onApply: (next: FrameRef | GlazingRef) => void;
}) {
  const initialSelection = useMemo(() => defaultRefreshSelection(slot), [slot]);
  const [selection, setSelection] = useState<RefreshSelection>(initialSelection);
  const applyEnabled = canApplyRefresh(slot);

  const setChoice = (key: string, choice: RefreshFieldChoice) =>
    setSelection((current) => ({ ...current, [key]: choice }));

  return (
    <ModalDialog title="Review catalog refresh" titleId="window-refresh-title" onClose={onCancel}>
      <div className="refresh-dialog">
        {slot.state === "source_deactivated" ? (
          <p className="form-note">
            The source catalog row is inactive. Keep the saved values or pick another catalog row.
          </p>
        ) : null}
        <div className="refresh-field-list">
          {slot.fields.map((field) => (
            <fieldset className="refresh-field-row" key={field.key}>
              <legend>
                <span>{field.key}</span>
                {field.is_overridden ? <span className="override-badge">Override</span> : null}
              </legend>
              <div className="refresh-values">
                <code>{formatRefreshValue(field.ref_value)}</code>
                <code>{formatRefreshValue(field.catalog_value)}</code>
              </div>
              <label>
                <input
                  type="radio"
                  name={`refresh-${field.key}`}
                  checked={(selection[field.key] ?? "keep") === "keep"}
                  onChange={() => setChoice(field.key, "keep")}
                />
                Keep mine
              </label>
              <label>
                <input
                  type="radio"
                  name={`refresh-${field.key}`}
                  checked={selection[field.key] === "update"}
                  onChange={() => setChoice(field.key, "update")}
                  disabled={!applyEnabled}
                />
                Update from catalog
              </label>
            </fieldset>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !applyEnabled}
            onClick={() => onApply(applyRefreshSelection(refValue, slot, selection))}
          >
            Apply
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}

function formatRefreshValue(value: unknown): string {
  return formatClipboardValue(value) || "(blank)";
}
