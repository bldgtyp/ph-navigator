import type { BuildEmptyRow } from "../../../shared/ui/data-table";
import { emptyElectricHeater } from "../lib";
import type { ElectricHeaterRow } from "../types";
import { customNumberValue, customTextValueOrNull } from "./customValueReaders";
import { readNumberDefault, readStringDefault } from "./fieldDefaults";

export function makeBuildEmptyElectricHeaterRow(): BuildEmptyRow<ElectricHeaterRow> {
  return ({ rowId, fieldDefaults }) => {
    const base = { ...emptyElectricHeater(), id: rowId };
    return {
      ...base,
      notes: readStringDefault(fieldDefaults.notes, base.notes),
      url: readStringDefault(fieldDefaults.url, base.url),
      custom_values: {
        ...base.custom_values,
        record_id: readStringDefault(
          fieldDefaults.record_id,
          customTextValueOrNull(base, "record_id"),
        ),
        name: readStringDefault(fieldDefaults.name, customTextValueOrNull(base, "name")),
        model: readStringDefault(fieldDefaults.model, customTextValueOrNull(base, "model")),
        manufacturer: readStringDefault(
          fieldDefaults.manufacturer,
          customTextValueOrNull(base, "manufacturer"),
        ),
        watt: readNumberDefault(fieldDefaults.watt, customNumberValue(base, "watt")),
      },
    };
  };
}
