import type { CellWrite } from "../../../shared/ui/data-table";
import { validateVentilatorsPayload, ventilatorsPayloadFromCellWrites } from "../lib.ts";
import {
  VENTILATOR_INSIDE_OUTSIDE_KEY,
  type VentilatorRow,
  type VentilatorsReplacePayload,
  type VentilatorsSlice,
} from "../types";

const VENTILATOR_MODAL_CUSTOM_FIELD_KEYS = [
  "record_id",
  "name",
  "airflow_rate_m3h",
  "model",
  "manufacturer",
  "heat_recovery_percent",
  "moisture_recovery_percent",
  "electrical_efficiency_wh_m3",
  "filter_merv_rating",
] as const;

export function ventilatorCellWritesFromModalRow(row: VentilatorRow): CellWrite[] {
  return [
    { rowId: row.id, fieldKey: VENTILATOR_INSIDE_OUTSIDE_KEY, value: row.inside_outside },
    { rowId: row.id, fieldKey: "url", value: row.url },
    { rowId: row.id, fieldKey: "notes", value: row.notes },
    ...VENTILATOR_MODAL_CUSTOM_FIELD_KEYS.map((fieldKey) => ({
      rowId: row.id,
      fieldKey,
      value: row.custom_values[fieldKey] ?? null,
    })),
  ];
}

export function ventilatorsPayloadFromModalRow(
  current: VentilatorsSlice,
  row: VentilatorRow,
): VentilatorsReplacePayload {
  const payload = ventilatorsPayloadFromCellWrites(
    current,
    ventilatorCellWritesFromModalRow(row),
    {},
  );
  const validationMessage = validateVentilatorsPayload(payload);
  if (validationMessage) throw new Error(validationMessage);
  return payload;
}
