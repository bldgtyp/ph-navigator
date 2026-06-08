import type { BuildEmptyRow } from "../../../shared/ui/data-table";
import { emptyHotWaterTank } from "../lib";
import { HOT_WATER_TANK_TYPE_KEY, type HotWaterTankRow } from "../types";
import { customNumberValue, customTextValueOrNull } from "./customValueReaders";
import { readNumberDefault, readStringDefault } from "./fieldDefaults";

export function makeBuildEmptyHotWaterTankRow(): BuildEmptyRow<HotWaterTankRow> {
  return ({ rowId, fieldDefaults }) => {
    const base = { ...emptyHotWaterTank(), id: rowId };
    return {
      ...base,
      tank_type: readStringDefault(fieldDefaults[HOT_WATER_TANK_TYPE_KEY], base.tank_type),
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
        inside_outside: readStringDefault(
          fieldDefaults.inside_outside,
          customTextValueOrNull(base, "inside_outside"),
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
      },
    };
  };
}
