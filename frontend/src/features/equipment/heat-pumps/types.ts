import type { BaseTableSlice } from "../../project_document/table-slice";

export type HeatPumpTableKey = "outdoor-equip" | "indoor-equip" | "outdoor-units" | "indoor-units";

export const HEAT_PUMP_OUTDOOR_EQUIP_TABLE_NAME = "heat_pumps_outdoor_equip";
export const HEAT_PUMP_INDOOR_EQUIP_TABLE_NAME = "heat_pumps_indoor_equip";
export const HEAT_PUMP_OUTDOOR_UNITS_TABLE_NAME = "heat_pumps_outdoor_units";
export const HEAT_PUMP_INDOOR_UNITS_TABLE_NAME = "heat_pumps_indoor_units";

/**
 * Phius Multiple HP Performance Estimator dropdown values for the
 * heating-data-type and cooling-data-type cells. The exact strings
 * (including the slash in `"EER2/SEER2"`) match the calc; renaming
 * them would silently break paste-into-Phius.
 */
export type HeatingDataType = "COPs" | "HSPF" | "HSPF2";
export type CoolingDataType = "EER/SEER" | "EER2/SEER2" | "IEER";

export const HEATING_DATA_TYPES: readonly HeatingDataType[] = ["COPs", "HSPF", "HSPF2"] as const;
export const COOLING_DATA_TYPES: readonly CoolingDataType[] = [
  "EER/SEER",
  "EER2/SEER2",
  "IEER",
] as const;

export type HeatPumpOutdoorEquipRow = {
  id: string;
  tag: string;
  manufacturer: string | null;
  model_number: string | null;
  paired_indoor_equip_id: string | null;
  system_family: string | null;
  refrigerant: string | null;
  heating_cap_kw_17f: number | null;
  heating_cap_kw_47f: number | null;
  heating_data_type: HeatingDataType | null;
  heating_cop_17f: number | null;
  heating_cop_47f: number | null;
  // Single seasonal-heating efficiency value; interpreted as HSPF or HSPF2
  // depending on `heating_data_type`.
  hspf: number | null;
  cooling_cap_kw_95f: number | null;
  cooling_data_type: CoolingDataType | null;
  // EER/SEER hold the cooling values; interpreted as legacy or AHRI-2023
  // depending on `cooling_data_type`. IEER is used only when type=IEER.
  eer: number | null;
  seer: number | null;
  ieer: number | null;
  datasheet_asset_ids: string[];
  notes: string | null;
  catalog_origin: Record<string, unknown> | null;
};

export type HeatPumpIndoorEquipRow = {
  id: string;
  tag: string;
  manufacturer: string | null;
  model_type: string | null;
  model_number: string | null;
  install_type: string | null;
  nominal_tons: number | null;
  fan_speed_cfm: number | null;
  cooling_btuh: number | null;
  heating_btuh_47f: number | null;
  heating_btuh_17f: number | null;
  heating_cop: number | null;
  seer: number | null;
  eer: number | null;
  hspf: number | null;
  datasheet_asset_ids: string[];
  notes: string | null;
  catalog_origin: Record<string, unknown> | null;
};

export type HeatPumpOutdoorUnitRow = {
  id: string;
  tag: string;
  outdoor_equip_id: string;
  datasheet_asset_ids: string[];
  notes: string | null;
};

export type HeatPumpIndoorUnitRow = {
  id: string;
  tag: string;
  indoor_equip_id: string;
  outdoor_unit_id: string | null;
  linked_erv_unit_id: string | null;
  served_room_ids: string[];
  datasheet_asset_ids: string[];
  notes: string | null;
};

export type HeatPumpSingleSelectOption = {
  id: string;
  label: string;
  color: string;
  order: number;
};

/**
 * Single-select option keys exposed on the heat-pumps slice response. Mirrors
 * `HEAT_PUMP_VISIBLE_OPTION_KEYS` in backend/features/heat_pumps/models.py.
 * These `heat_pumps.*` keys are owned by this slice and editable through
 * {@link useHeatPumpOptionMutation}.
 */
export const HEAT_PUMP_OPTION_KEYS = {
  manufacturer: "heat_pumps.manufacturer",
  systemFamily: "heat_pumps.system_family",
  refrigerant: "heat_pumps.refrigerant",
  modelType: "heat_pumps.model_type",
  installType: "heat_pumps.install_type",
} as const;

export const HEAT_PUMP_OWNED_OPTION_KEYS = [
  HEAT_PUMP_OPTION_KEYS.manufacturer,
  HEAT_PUMP_OPTION_KEYS.systemFamily,
  HEAT_PUMP_OPTION_KEYS.refrigerant,
  HEAT_PUMP_OPTION_KEYS.modelType,
  HEAT_PUMP_OPTION_KEYS.installType,
] as const;

export type HeatPumpOwnedOptionKey = (typeof HEAT_PUMP_OWNED_OPTION_KEYS)[number];

export type HeatPumpOptionPatchOp = {
  op: "add" | "replace" | "remove";
  option: HeatPumpSingleSelectOption;
};

export type HeatPumpsSlice = BaseTableSlice & {
  outdoor_equip: HeatPumpOutdoorEquipRow[];
  indoor_equip: HeatPumpIndoorEquipRow[];
  outdoor_units: HeatPumpOutdoorUnitRow[];
  indoor_units: HeatPumpIndoorUnitRow[];
  single_select_options: Record<string, HeatPumpSingleSelectOption[]>;
};

export type HeatPumpPatchOp =
  | { op: "add"; path: "/-"; value: HeatPumpPatchRow }
  | { op: "replace"; path: `/${string}`; value: HeatPumpPatchRow }
  | { op: "remove"; path: `/${string}`; value?: null };

export type HeatPumpPatchRow =
  | HeatPumpOutdoorEquipRow
  | HeatPumpIndoorEquipRow
  | HeatPumpOutdoorUnitRow
  | HeatPumpIndoorUnitRow;

export type CascadeReference = {
  table: string;
  row_id: string;
  tag: string;
  field: string;
};

export type CascadePreview = {
  affected: CascadeReference[];
};

export type HeatPumpsPatchResponse = HeatPumpsSlice & {
  cascade_preview?: CascadePreview | null;
};

export type PhiusExportWarningField = "heating" | "cooling" | "qty";

export type PhiusExportRow = {
  row_id: string;
  device: string;
  qty: number;
  cap_17f: number | null;
  cap_47f: number | null;
  heating_data_type: HeatingDataType | null;
  cop_17f: number | null;
  cop_47f: number | null;
  hspf: number | null;
  cap_95f: number | null;
  cooling_data_type: CoolingDataType | null;
  eer: number | null;
  seer: number | null;
  ieer: number | null;
};

export type PhiusExportWarning = {
  row_id: string;
  tag: string;
  field: PhiusExportWarningField;
  message: string;
};

export type PhiusExportResponse = {
  rows: PhiusExportRow[];
  warnings: PhiusExportWarning[];
  csv: string;
};
