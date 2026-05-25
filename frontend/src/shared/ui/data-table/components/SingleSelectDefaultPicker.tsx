import type { FieldOption } from "../types";

export type SingleSelectDefaultPickerProps = {
  options: readonly FieldOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
};

export function SingleSelectDefaultPicker({
  options,
  value,
  onChange,
  disabled = false,
}: SingleSelectDefaultPickerProps) {
  return (
    <label className="data-table-add-field-label data-table-single-select-default-picker">
      Default option
      <select
        className="data-table-add-field-input"
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value || null)}
      >
        <option value="">No default</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
