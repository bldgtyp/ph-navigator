import { AutocompleteSelect } from "../../AutocompleteSelect";
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
    <AutocompleteSelect
      className="data-table-single-select-default-picker"
      label="Default option"
      value={value ?? ""}
      disabled={disabled}
      options={[
        { value: "", label: "No default" },
        ...options.map((option) => ({
          value: option.id,
          label: option.label,
          color: option.color,
        })),
      ]}
      onChange={(nextValue) => onChange(nextValue || null)}
    />
  );
}
