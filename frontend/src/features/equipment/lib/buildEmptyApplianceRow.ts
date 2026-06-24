import type { BuildEmptyRow } from "../../../shared/ui/data-table";
import { emptyAppliance } from "../lib";
import {
  APPLIANCE_ENERGY_STAR_KEY,
  APPLIANCE_TYPE_KEY,
  STATUS_DEFAULT_OPTION_ID,
  STATUS_FIELD_KEY,
  type ApplianceRow,
} from "../types";
import { customNumberValue, customTextValueOrNull } from "./customValueReaders";
import { readNumberDefault, readStatusDefault, readStringDefault } from "./fieldDefaults";

export function makeBuildEmptyApplianceRow(): BuildEmptyRow<ApplianceRow> {
  return ({ rowId, fieldDefaults }) => {
    const base = { ...emptyAppliance(), id: rowId };
    return {
      ...base,
      appliance_type: readStringDefault(fieldDefaults[APPLIANCE_TYPE_KEY], base.appliance_type),
      energy_star: readStringDefault(fieldDefaults[APPLIANCE_ENERGY_STAR_KEY], base.energy_star),
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
        capacity_m3: readNumberDefault(
          fieldDefaults.capacity_m3,
          customNumberValue(base, "capacity_m3"),
        ),
        cef: readNumberDefault(fieldDefaults.cef, customNumberValue(base, "cef")),
        imef: readNumberDefault(fieldDefaults.imef, customNumberValue(base, "imef")),
        mef: readNumberDefault(fieldDefaults.mef, customNumberValue(base, "mef")),
        annual_energy_kwh: readNumberDefault(
          fieldDefaults.annual_energy_kwh,
          customNumberValue(base, "annual_energy_kwh"),
        ),
        [STATUS_FIELD_KEY]: readStatusDefault(
          fieldDefaults[STATUS_FIELD_KEY],
          STATUS_DEFAULT_OPTION_ID,
        ),
      },
    };
  };
}
