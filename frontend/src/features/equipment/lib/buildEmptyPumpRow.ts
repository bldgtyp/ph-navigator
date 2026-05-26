import type { BuildEmptyRow } from "../../../shared/ui/data-table";
import { emptyPump } from "../lib";
import { PUMP_DEVICE_TYPE_KEY, type PumpRow } from "../types";

export function makeBuildEmptyPumpRow(): BuildEmptyRow<PumpRow> {
  return ({ rowId, fieldDefaults, anchorRow }) => {
    const base = anchorRow ? { ...anchorRow, id: rowId } : { ...emptyPump(), id: rowId };
    return {
      ...base,
      device_type: readStringDefault(fieldDefaults[PUMP_DEVICE_TYPE_KEY], base.device_type),
      use: readStringDefault(fieldDefaults.use, base.use),
      tag: readStringDefault(fieldDefaults.tag, null),
      manufacturer: readStringDefault(fieldDefaults.manufacturer, base.manufacturer),
      model: readStringDefault(fieldDefaults.model, base.model),
      volts: readNumberDefault(fieldDefaults.volts, base.volts),
      phase: readNumberDefault(fieldDefaults.phase, base.phase),
      horse_power: readNumberDefault(fieldDefaults.horse_power, base.horse_power),
      wattage: readNumberDefault(fieldDefaults.wattage, base.wattage),
      flow_gpm: readNumberDefault(fieldDefaults.flow_gpm, base.flow_gpm),
      runtime_khr_yr: readNumberDefault(fieldDefaults.runtime_khr_yr, base.runtime_khr_yr),
      notes: readStringDefault(fieldDefaults.notes, base.notes),
      link: readStringDefault(fieldDefaults.link, base.link),
      datasheet_asset_ids: [...base.datasheet_asset_ids],
    };
  };
}

function readStringDefault(value: unknown, fallback: string | null): string | null {
  return value === null || typeof value === "string" ? value : fallback;
}

function readNumberDefault(value: unknown, fallback: number | null): number | null {
  return value === null || typeof value === "number" ? value : fallback;
}
