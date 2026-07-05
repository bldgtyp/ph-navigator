import type { BuildEmptyRow } from "../../../shared/ui/data-table";
import { emptyHotWaterTank } from "../lib";
import {
  HOT_WATER_TANK_INSIDE_OUTSIDE_KEY,
  HOT_WATER_TANK_TYPE_KEY,
  STATUS_DEFAULT_OPTION_ID,
  STATUS_FIELD_KEY,
  type HotWaterTankRow,
} from "../types";
import { customNumberValue, customTextValueOrNull } from "./customValueReaders";
import { readNumberDefault, readStatusDefault, readStringDefault } from "./fieldDefaults";

export function makeBuildEmptyHotWaterTankRow(): BuildEmptyRow<HotWaterTankRow> {
  return ({ rowId, fieldDefaults }) => {
    const base = { ...emptyHotWaterTank(), id: rowId };
    return {
      ...base,
      tank_type: readStringDefault(fieldDefaults[HOT_WATER_TANK_TYPE_KEY], base.tank_type),
      inside_outside: readStringDefault(
        fieldDefaults[HOT_WATER_TANK_INSIDE_OUTSIDE_KEY],
        base.inside_outside,
      ),
      notes: readStringDefault(fieldDefaults.notes, base.notes),
      url: readStringDefault(fieldDefaults.url, base.url),
      custom_values: {
        ...base.custom_values,
        record_id: readStringDefault(
          fieldDefaults.record_id,
          customTextValueOrNull(base, "record_id"),
        ),
        name: readStringDefault(fieldDefaults.name, customTextValueOrNull(base, "name")),
        quantity: readNumberDefault(fieldDefaults.quantity, customNumberValue(base, "quantity")),
        location_temp_c: readNumberDefault(
          fieldDefaults.location_temp_c,
          customNumberValue(base, "location_temp_c"),
        ),
        water_temp_c: readNumberDefault(
          fieldDefaults.water_temp_c,
          customNumberValue(base, "water_temp_c"),
        ),
        manufacturer: readStringDefault(
          fieldDefaults.manufacturer,
          customTextValueOrNull(base, "manufacturer"),
        ),
        model: readStringDefault(fieldDefaults.model, customTextValueOrNull(base, "model")),
        size_l: readNumberDefault(fieldDefaults.size_l, customNumberValue(base, "size_l")),
        heat_loss_rate_w_k: readNumberDefault(
          fieldDefaults.heat_loss_rate_w_k,
          customNumberValue(base, "heat_loss_rate_w_k"),
        ),
        [STATUS_FIELD_KEY]: readStatusDefault(
          fieldDefaults[STATUS_FIELD_KEY],
          STATUS_DEFAULT_OPTION_ID,
        ),
      },
    };
  };
}
