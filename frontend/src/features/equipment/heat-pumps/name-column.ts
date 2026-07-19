import {
  identifierColumnDef,
  type DataTableColumnDef,
  type FieldDef,
} from "../../../shared/ui/data-table";
import { HEAT_PUMP_BUILT_IN_LOCKS, readCustomStringValue } from "./field-defs";

// The built-in `name` ("Display Name") field is shared by all four Heat-Pump
// leaves and, like `status`, its value lives in `custom_values.name` rather
// than a typed row column (payload-builders routes writes accordingly). The
// column is the pinned identifier — same role `name` plays on every other
// equipment table.
export const NAME_FIELD_KEY = "name";
export const NAME_DISPLAY_NAME = "Display Name";

export function displayNameFieldDef(): FieldDef {
  return {
    field_key: NAME_FIELD_KEY,
    field_type: "text",
    custom_field_type: "short_text",
    display_name: NAME_DISPLAY_NAME,
    built_in: true,
    locked: HEAT_PUMP_BUILT_IN_LOCKS,
  };
}

export function displayNameColumnDef<
  TRow extends { custom_values?: Record<string, unknown> | null },
>(): DataTableColumnDef<TRow> {
  return identifierColumnDef({
    id: NAME_FIELD_KEY,
    fieldKey: NAME_FIELD_KEY,
    header: NAME_DISPLAY_NAME,
    accessor: (row) => readCustomStringValue(row, NAME_FIELD_KEY),
  });
}
