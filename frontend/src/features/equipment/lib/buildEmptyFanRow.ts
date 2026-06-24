import type { BuildEmptyRow } from "../../../shared/ui/data-table";
import { emptyFan } from "../lib";
import { FAN_TYPE_KEY, STATUS_DEFAULT_OPTION_ID, STATUS_FIELD_KEY, type FanRow } from "../types";
import { customNumberValue, customTextValueOrNull } from "./customValueReaders";
import { readNumberDefault, readStatusDefault, readStringDefault } from "./fieldDefaults";

export function makeBuildEmptyFanRow(): BuildEmptyRow<FanRow> {
  return ({ rowId, fieldDefaults }) => {
    const base = { ...emptyFan(), id: rowId };
    return {
      ...base,
      fan_type: readStringDefault(fieldDefaults[FAN_TYPE_KEY], base.fan_type),
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
        annual_runtime_min_yr: readNumberDefault(
          fieldDefaults.annual_runtime_min_yr,
          customNumberValue(base, "annual_runtime_min_yr"),
        ),
        airflow_m3h: readNumberDefault(
          fieldDefaults.airflow_m3h,
          customNumberValue(base, "airflow_m3h"),
        ),
        amps: readNumberDefault(fieldDefaults.amps, customNumberValue(base, "amps")),
        volts: readNumberDefault(fieldDefaults.volts, customNumberValue(base, "volts")),
        power_factor: readNumberDefault(
          fieldDefaults.power_factor,
          customNumberValue(base, "power_factor"),
        ),
        watts: readNumberDefault(fieldDefaults.watts, customNumberValue(base, "watts")),
        [STATUS_FIELD_KEY]: readStatusDefault(
          fieldDefaults[STATUS_FIELD_KEY],
          STATUS_DEFAULT_OPTION_ID,
        ),
      },
    };
  };
}
