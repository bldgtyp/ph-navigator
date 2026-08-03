import type { FieldDef, FieldOption } from "../../../shared/ui/data-table";
import { STATUS_DEFAULT_OPTION_ID, STATUS_DISPLAY_NAME, STATUS_FIELD_KEY } from "../types";
import { STATUS_DESCRIPTION } from "../../../shared/ui/data-table/status";
import { HEAT_PUMP_SELECT_LOCKS } from "./field-defs";

// The built-in `status` single-select is shared by all four Heat-Pump
// leaves (Outdoor/Indoor Equipment and Outdoor/Indoor Units). Its value
// lives in `custom_values.status`, so the
// column accessor reads the bag rather than a typed row column. The option
// list (locked for editing) comes from the slice's namespaced
// `<table>.status` option key; the generic DataTable single-select renderer
// paints the colored pill — no bespoke cell.
export function statusFieldDef(options: readonly FieldOption[] = []): FieldDef {
  return {
    field_key: STATUS_FIELD_KEY,
    field_type: "single_select",
    custom_field_type: "single_select",
    display_name: STATUS_DISPLAY_NAME,
    description: STATUS_DESCRIPTION,
    options: [...options],
    defaultOptionId: STATUS_DEFAULT_OPTION_ID,
    built_in: true,
    locked: HEAT_PUMP_SELECT_LOCKS,
  };
}
