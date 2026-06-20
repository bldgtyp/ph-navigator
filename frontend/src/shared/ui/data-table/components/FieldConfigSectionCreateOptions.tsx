import { useEffect, useMemo, useState } from "react";
import { AutocompleteSelect } from "../../AutocompleteSelect";
import { OPTION_COLOR_PALETTE, createFieldOption } from "../lib/options/create";
import { hasDuplicateFieldOptionLabels } from "../lib/options/references";
import { normalizeOptionOrders } from "../lib/options/normalize";
import type { FieldOption } from "../types";
import { SingleSelectDefaultPicker } from "./SingleSelectDefaultPicker";

export type CreateOptionsDraft = {
  options: FieldOption[];
  defaultOptionId: string | null;
  valid: boolean;
};

export type FieldConfigSectionCreateOptionsProps = {
  disabled?: boolean;
  onDraftChange: (draft: CreateOptionsDraft) => void;
};

export function FieldConfigSectionCreateOptions({
  disabled = false,
  onDraftChange,
}: FieldConfigSectionCreateOptionsProps) {
  const [options, setOptions] = useState<FieldOption[]>(() => [createFieldOption("", [])]);
  const [defaultOptionId, setDefaultOptionId] = useState<string | null>(null);

  const duplicateLabels = useMemo(() => hasDuplicateFieldOptionLabels(options), [options]);
  const hasEmptyLabel = options.some((option) => !option.label.trim());
  const normalizedOptions = useMemo(() => normalizeOptionOrders(options), [options]);
  const valid = options.length > 0 && !duplicateLabels && !hasEmptyLabel;

  useEffect(() => {
    const ids = new Set(options.map((option) => option.id));
    if (defaultOptionId !== null && !ids.has(defaultOptionId)) {
      setDefaultOptionId(null);
    }
  }, [defaultOptionId, options]);

  useEffect(() => {
    onDraftChange({
      options: normalizedOptions,
      defaultOptionId,
      valid,
    });
  }, [defaultOptionId, normalizedOptions, onDraftChange, valid]);

  return (
    <div className="data-table-field-config-modal-section">
      <span className="data-table-field-config-label">Options</span>
      <ul className="data-table-add-field-options" role="list">
        {options.map((option, index) => (
          <li key={option.id} className="data-table-add-field-option-row">
            <AutocompleteSelect
              className="data-table-add-field-option-color"
              aria-label={`Option color ${index + 1}`}
              value={option.color}
              disabled={disabled}
              compact
              options={OPTION_COLOR_PALETTE.map((swatch) => ({
                value: swatch,
                label: swatch,
                color: swatch,
              }))}
              onChange={(color) => updateOption(option.id, { color })}
            />
            <input
              type="text"
              className="data-table-add-field-input"
              aria-label={`Option label ${index + 1}`}
              value={option.label}
              maxLength={120}
              disabled={disabled}
              onChange={(event) => updateOption(option.id, { label: event.target.value })}
            />
            <button
              type="button"
              className="secondary-button"
              aria-label={`Remove option ${index + 1}`}
              disabled={disabled || options.length === 1}
              onClick={() => removeOption(option.id)}
            >
              x
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="data-table-view-popover-add data-table-field-editor-add"
        onClick={addOption}
        disabled={disabled}
      >
        + Add option
      </button>
      <SingleSelectDefaultPicker
        options={options.filter((option) => option.label.trim())}
        value={defaultOptionId}
        onChange={setDefaultOptionId}
        disabled={disabled}
      />
      {duplicateLabels ? (
        <p className="form-error data-table-field-editor-error">Option labels must be unique.</p>
      ) : null}
      {hasEmptyLabel ? (
        <p className="form-error data-table-field-editor-error">Every option needs a label.</p>
      ) : null}
    </div>
  );

  function updateOption(id: string, patch: Partial<FieldOption>) {
    setOptions((current) =>
      current.map((option) => (option.id === id ? { ...option, ...patch } : option)),
    );
  }

  function removeOption(id: string) {
    setOptions((current) => current.filter((option) => option.id !== id));
    setDefaultOptionId((current) => (current === id ? null : current));
  }

  function addOption() {
    setOptions((current) => [...current, createFieldOption("", current)]);
  }
}
