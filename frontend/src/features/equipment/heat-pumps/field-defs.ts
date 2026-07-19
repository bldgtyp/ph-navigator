import type { NumberUnitsConfig } from "../../../lib/units";
import { ALL_FIELD_LOCKS, type FieldDef, type FieldOption } from "../../../shared/ui/data-table";

export const HEAT_PUMP_RECORD_ID_SCHEMA_FIELD_KEY = "record_id";

export const HEAT_PUMP_BUILT_IN_LOCKS = ["field_type", "delete", "duplicate"] as const;
export const HEAT_PUMP_SELECT_LOCKS = ["field_type", "options", "delete", "duplicate"] as const;
export const HEAT_PUMP_RECORD_LOCKS = ["display_name", "delete", "duplicate"] as const;

// Heat-pump capacity is stored canonically in kW; the DataTable resolves
// the live header label and parses/formats cell input via the global
// SI/IP toggle. Phius export converts back to kBtu/h on the way out.
export const HEAT_PUMP_POWER_UNITS: NumberUnitsConfig = {
  mode: "fixed",
  unit_type: "power",
  si_unit: "kw",
  ip_unit: "kbtu_h",
  precision_si: 2,
  precision_ip: 1,
};

// Shared accessor for built-in fields whose values ride in `custom_values`
// (`status`, `name`) rather than a typed row column.
export function readCustomStringValue(
  row: { custom_values?: Record<string, unknown> | null },
  fieldKey: string,
): string | null {
  const value = row.custom_values?.[fieldKey];
  return typeof value === "string" ? value : null;
}

export function heatPumpTagField(): FieldDef {
  return {
    field_key: "tag",
    field_type: "text",
    custom_field_type: "short_text",
    display_name: "Tag",
    built_in: true,
    required: true,
    locked: HEAT_PUMP_RECORD_LOCKS,
  };
}

export function heatPumpTextField(
  field_key: string,
  display_name: string,
  description?: string,
): FieldDef {
  return {
    field_key,
    field_type: "text",
    custom_field_type: "short_text",
    display_name,
    built_in: true,
    locked: HEAT_PUMP_BUILT_IN_LOCKS,
    ...(description ? { description } : {}),
  };
}

export function heatPumpNumberField(
  field_key: string,
  display_name: string,
  description?: string,
): FieldDef {
  return {
    field_key,
    field_type: "number",
    custom_field_type: "number",
    display_name,
    built_in: true,
    locked: HEAT_PUMP_BUILT_IN_LOCKS,
    ...(description ? { description } : {}),
  };
}

export function heatPumpPowerField(field_key: string, display_name: string): FieldDef {
  return {
    ...heatPumpNumberField(field_key, display_name),
    numberUnits: HEAT_PUMP_POWER_UNITS,
  };
}

export function heatPumpSelectField(
  field_key: string,
  display_name: string,
  options: FieldOption[] = [],
): FieldDef {
  return {
    field_key,
    field_type: "single_select",
    custom_field_type: "single_select",
    display_name,
    options,
    built_in: true,
    locked: HEAT_PUMP_SELECT_LOCKS,
  };
}

export function heatPumpAttachmentField(field_key: string, display_name: string): FieldDef {
  return {
    field_key,
    field_type: "attachment",
    custom_field_type: "long_text",
    display_name,
    built_in: true,
    locked: ALL_FIELD_LOCKS,
  };
}

export function heatPumpLinkedRecordField({
  field_key,
  display_name,
  target_table_path,
  max_links,
  required,
  description,
}: {
  field_key: string;
  display_name: string;
  target_table_path: readonly string[];
  max_links: number | null;
  required?: boolean;
  description?: string;
}): FieldDef {
  return {
    field_key,
    field_type: "linked_record",
    custom_field_type: "linked_record",
    display_name,
    required,
    description,
    built_in: true,
    locked: HEAT_PUMP_BUILT_IN_LOCKS,
    linked_record_config: {
      target_table_path: [...target_table_path],
      max_links,
    },
  };
}
