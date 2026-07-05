import type { BuildEmptyRow } from "../../../shared/ui/data-table";
import { emptyVentilator } from "../lib";
import {
  STATUS_DEFAULT_OPTION_ID,
  STATUS_FIELD_KEY,
  VENTILATOR_FROST_PROTECTION_KEY,
  VENTILATOR_INSIDE_OUTSIDE_KEY,
  type VentilatorRow,
} from "../types";
import { customNumberValue, customTextValueOrNull } from "./customValueReaders";
import { readNumberDefault, readStatusDefault, readStringDefault } from "./fieldDefaults";

export function makeBuildEmptyVentilatorRow(): BuildEmptyRow<VentilatorRow> {
  return ({ rowId, fieldDefaults }) => {
    const base = { ...emptyVentilator(), id: rowId };
    return {
      ...base,
      inside_outside: readStringDefault(
        fieldDefaults[VENTILATOR_INSIDE_OUTSIDE_KEY],
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
        airflow_rate_m3h: readNumberDefault(
          fieldDefaults.airflow_rate_m3h,
          customNumberValue(base, "airflow_rate_m3h"),
        ),
        model: readStringDefault(fieldDefaults.model, customTextValueOrNull(base, "model")),
        manufacturer: readStringDefault(
          fieldDefaults.manufacturer,
          customTextValueOrNull(base, "manufacturer"),
        ),
        heat_recovery_percent: readNumberDefault(
          fieldDefaults.heat_recovery_percent,
          customNumberValue(base, "heat_recovery_percent"),
        ),
        moisture_recovery_percent: readNumberDefault(
          fieldDefaults.moisture_recovery_percent,
          customNumberValue(base, "moisture_recovery_percent"),
        ),
        electrical_efficiency_wh_m3: readNumberDefault(
          fieldDefaults.electrical_efficiency_wh_m3,
          customNumberValue(base, "electrical_efficiency_wh_m3"),
        ),
        filter_merv_rating: readNumberDefault(
          fieldDefaults.filter_merv_rating,
          customNumberValue(base, "filter_merv_rating"),
        ),
        [VENTILATOR_FROST_PROTECTION_KEY]: readStringDefault(
          fieldDefaults[VENTILATOR_FROST_PROTECTION_KEY],
          customTextValueOrNull(base, VENTILATOR_FROST_PROTECTION_KEY),
        ),
        frost_protection_limit_temp_c: readNumberDefault(
          fieldDefaults.frost_protection_limit_temp_c,
          customNumberValue(base, "frost_protection_limit_temp_c"),
        ),
        [STATUS_FIELD_KEY]: readStatusDefault(
          fieldDefaults[STATUS_FIELD_KEY],
          STATUS_DEFAULT_OPTION_ID,
        ),
      },
    };
  };
}
