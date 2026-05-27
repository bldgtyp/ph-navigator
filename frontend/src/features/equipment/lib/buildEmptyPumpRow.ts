import type { BuildEmptyRow } from "../../../shared/ui/data-table";
import { emptyPump } from "../lib";
import { PUMP_DEVICE_TYPE_KEY, type PumpRow } from "../types";
import { customNumberValue, customTextValueOrNull } from "./customValueReaders";
import { readNumberDefault, readStringDefault } from "./fieldDefaults";

export function makeBuildEmptyPumpRow(): BuildEmptyRow<PumpRow> {
  return ({ rowId, fieldDefaults }) => {
    const base = { ...emptyPump(), id: rowId };
    return {
      ...base,
      device_type: readStringDefault(fieldDefaults[PUMP_DEVICE_TYPE_KEY], base.device_type),
      phase: readNumberDefault(fieldDefaults.phase, base.phase),
      notes: readStringDefault(fieldDefaults.notes, base.notes),
      link: readStringDefault(fieldDefaults.link, base.link),
      datasheet_asset_ids: [...base.datasheet_asset_ids],
      custom_values: {
        ...base.custom_values,
        record_id: readStringDefault(
          fieldDefaults.record_id,
          customTextValueOrNull(base, "record_id"),
        ),
        use: readStringDefault(fieldDefaults.use, customTextValueOrNull(base, "use")),
        manufacturer: readStringDefault(
          fieldDefaults.manufacturer,
          customTextValueOrNull(base, "manufacturer"),
        ),
        model: readStringDefault(fieldDefaults.model, customTextValueOrNull(base, "model")),
        volts: readNumberDefault(fieldDefaults.volts, customNumberValue(base, "volts")),
        horse_power: readNumberDefault(
          fieldDefaults.horse_power,
          customNumberValue(base, "horse_power"),
        ),
        wattage: readNumberDefault(fieldDefaults.wattage, customNumberValue(base, "wattage")),
        flow_gpm: readNumberDefault(fieldDefaults.flow_gpm, customNumberValue(base, "flow_gpm")),
        runtime_khr_yr: readNumberDefault(
          fieldDefaults.runtime_khr_yr,
          customNumberValue(base, "runtime_khr_yr"),
        ),
      },
    };
  };
}
