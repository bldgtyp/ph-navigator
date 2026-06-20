import {
  AlignLeft,
  ArrowRightLeft,
  CircleChevronDown,
  Hash,
  Link,
  Palette,
  SquareFunction,
  Type,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useMemo } from "react";
import { AutocompleteSelect, type AutocompleteSelectOption } from "../../AutocompleteSelect";
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
      listboxPlacement="portal"
      listboxClassName="data-table-field-config-type-listbox"
      onChange={handleChange}
      renderOption={renderFieldTypeOption}
    />
  );
}

const FIELD_TYPE_OPTION_ICONS: Record<CustomFieldType, LucideIcon> = {
  short_text: Type,
  long_text: AlignLeft,
  number: Hash,
  url: Link,
  single_select: CircleChevronDown,
  color: Palette,
  formula: SquareFunction,
  linked_record: ArrowRightLeft,
};

function renderFieldTypeOption(option: AutocompleteSelectOption) {
  const Icon = FIELD_TYPE_OPTION_ICONS[option.value as CustomFieldType] ?? Type;
  return (
    <span className="data-table-field-config-type-option">
      <span className="data-table-field-type-icon" aria-hidden="true">
        <Icon size={14} strokeWidth={2} />
      </span>
      <span>{option.label}</span>
    </span>
  );
}
