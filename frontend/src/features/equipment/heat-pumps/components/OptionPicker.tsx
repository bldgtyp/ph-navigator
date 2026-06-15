import { useState } from "react";
import type { HeatPumpSingleSelectOption } from "../types";

export type OptionPickerProps = {
  label: string;
  value: string | null;
  options: readonly HeatPumpSingleSelectOption[];
  onChange: (next: string | null) => void;
  /**
   * Called when the user types a new label into the "Add option" inline form
   * and submits it. The handler should persist the new option and return its
   * minted id; the picker then selects it for this row. When omitted the
   * "Add option" affordance is hidden — used in read-only mode and for picker
   * surfaces that don't own the option list.
   */
  onCreate?: (label: string) => Promise<string>;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * Single-select dropdown for one of the heat-pump option lists, with an
 * optional inline "Add option" form. The cell-popover supports the same
 * find-or-create gesture from the grid, but a modal-only edit flow also needs
 * a write path; this component is the smaller of the two surfaces and so
 * doesn't try to look like Airtable — a `<select>` + a tiny "Add option"
 * disclosure keeps the modal focused on the row being edited.
 */
export function OptionPicker({
  label,
  value,
  options,
  onChange,
  onCreate,
  disabled = false,
  placeholder = "Not set",
}: OptionPickerProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitNew = async () => {
    if (!onCreate) return;
    const trimmed = draft.trim();
    if (!trimmed) {
      setError("Option label is required.");
      return;
    }
    if (
      options.some(
        (option) => option.label.trim().toLocaleLowerCase() === trimmed.toLocaleLowerCase(),
      )
    ) {
      setError("That option already exists; pick it from the list.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const optionId = await onCreate(trimmed);
      onChange(optionId);
      setDraft("");
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add option.");
    } finally {
      setPending(false);
    }
  };

  return (
    <label>
      {label}
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {!disabled && onCreate ? (
        adding ? (
          <span className="hp-option-add-inline">
            <input
              autoFocus
              value={draft}
              placeholder="New option label"
              onChange={(event) => {
                setDraft(event.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submitNew();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setAdding(false);
                  setDraft("");
                  setError(null);
                }
              }}
              disabled={pending}
            />
            <button
              type="button"
              className="secondary-button"
              onClick={() => void submitNew()}
              disabled={pending}
            >
              Add
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setAdding(false);
                setDraft("");
                setError(null);
              }}
              disabled={pending}
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="link-button hp-option-add-trigger"
            onClick={() => setAdding(true)}
          >
            + Add option
          </button>
        )
      ) : null}
      {error ? (
        <span className="form-error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
