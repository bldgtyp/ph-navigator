import { useCallback, useMemo } from "react";
import { AutocompleteSelect } from "../../AutocompleteSelect";
import type { CustomFieldType } from "../types";

export type FieldTypeSelectOption = {
  kind: CustomFieldType;
  label: string;
  disabled?: boolean;
  description?: string;
};

export type FieldTypeSelectProps = {
  value: CustomFieldType;
  options: readonly FieldTypeSelectOption[];
  disabled?: boolean;
  onChange: (next: CustomFieldType) => void;
};

export function FieldTypeSelect({
  value,
  options,
  disabled = false,
  onChange,
}: FieldTypeSelectProps) {
  const selectOptions = useMemo(
    () =>
      options.map((option) => ({
        value: option.kind,
        label: option.label,
        disabled: option.disabled,
        description: option.description,
      })),
    [options],
  );
  const handleChange = useCallback(
    (next: string) => {
      const selected = options.find((option) => option.kind === next);
      if (!selected || selected.disabled) return;
      onChange(selected.kind);
    },
    [onChange, options],
  );

  return (
    <AutocompleteSelect
      aria-label="Field type"
      className="data-table-field-config-type-select"
      value={value}
      options={selectOptions}
      disabled={disabled}
      placeholder="Choose field type..."
      onChange={handleChange}
    />
  );
}
