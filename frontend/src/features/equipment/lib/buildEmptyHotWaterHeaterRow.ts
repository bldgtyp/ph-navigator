import type { BuildEmptyRow } from "../../../shared/ui/data-table";
import { emptyHotWaterHeater } from "../lib";
import { HOT_WATER_HEATER_TYPE_KEY, type HotWaterHeaterRow } from "../types";
import { customNumberValue, customTextValueOrNull } from "./customValueReaders";
import { readNumberDefault, readStringDefault } from "./fieldDefaults";

export function makeBuildEmptyHotWaterHeaterRow(): BuildEmptyRow<HotWaterHeaterRow> {
  return ({ rowId, fieldDefaults }) => {
    const base = { ...emptyHotWaterHeater(), id: rowId };
    return {
      ...base,
      heater_type: readStringDefault(fieldDefaults[HOT_WATER_HEATER_TYPE_KEY], base.heater_type),
      phase: readNumberDefault(fieldDefaults.phase, base.phase),
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
        model: readStringDefault(fieldDefaults.model, customTextValueOrNull(base, "model")),
        manufacturer: readStringDefault(
          fieldDefaults.manufacturer,
          customTextValueOrNull(base, "manufacturer"),
        ),
        size_l: readNumberDefault(fieldDefaults.size_l, customNumberValue(base, "size_l")),
        temperature_c: readNumberDefault(
          fieldDefaults.temperature_c,
          customNumberValue(base, "temperature_c"),
        ),
        amps: readNumberDefault(fieldDefaults.amps, customNumberValue(base, "amps")),
        volts: readNumberDefault(fieldDefaults.volts, customNumberValue(base, "volts")),
        power_factor: readNumberDefault(
          fieldDefaults.power_factor,
          customNumberValue(base, "power_factor"),
        ),
        watts: readNumberDefault(fieldDefaults.watts, customNumberValue(base, "watts")),
        uef: readNumberDefault(fieldDefaults.uef, customNumberValue(base, "uef")),
      },
    };
  };
}
