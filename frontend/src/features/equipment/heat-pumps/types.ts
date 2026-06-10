import type { BaseTableSlice } from "../../project_document/table-slice";

export type HeatPumpTableKey = "outdoor-equip" | "indoor-equip" | "outdoor-units" | "indoor-units";

export type HeatingDataType = "cops" | "hspf2";
export type CoolingDataType = "eer2_seer2" | "ieer";

export type HeatPumpOutdoorEquipRow = {
  id: string;
  tag: string;
  manufacturer: string | null;
  model_number: string | null;
  paired_indoor_equip_id: string | null;
  system_family: string | null;
  refrigerant: string | null;
  heating_data_type: HeatingDataType | null;
  heating_cap_kbtuh_17f: number | null;
  heating_cap_kbtuh_47f: number | null;
  heating_cop_17f: number | null;
  heating_cop_47f: number | null;
  hspf2: number | null;
  hspf: number | null;
  cooling_data_type: CoolingDataType | null;
  cooling_cap_kbtuh_95f: number | null;
  eer2: number | null;
  seer2: number | null;
  ieer: number | null;
  eer: number | null;
  seer: number | null;
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
  building_zone: string | null;
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
  floor_level: string | null;
  area_served: string | null;
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
 * `HEAT_PUMP_VISIBLE_OPTION_KEYS` in backend/features/heat_pumps/models.py. The
 * five `heat_pumps.*` keys are owned by this slice and editable through
 * {@link useHeatPumpOptionMutation}; the two `rooms.*` keys are reused from the
 * rooms slice (read-only here).
 */
export const HEAT_PUMP_OPTION_KEYS = {
  manufacturer: "heat_pumps.manufacturer",
  systemFamily: "heat_pumps.system_family",
  refrigerant: "heat_pumps.refrigerant",
  modelType: "heat_pumps.model_type",
  installType: "heat_pumps.install_type",
  buildingZone: "rooms.building_zone",
  floorLevel: "rooms.floor_level",
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

export type PhiusExportWarningField =
  | "heating_data_type"
  | "heating_cap_kbtuh_17f"
  | "heating_cap_kbtuh_47f"
  | "heating_cop_17f"
  | "heating_cop_47f"
  | "hspf2"
  | "cooling_data_type"
  | "cooling_cap_kbtuh_95f"
  | "eer2"
  | "seer2"
  | "ieer"
  | "qty";

export type PhiusExportRow = {
  row_id: string;
  device: string;
  qty: number;
  heating_data_type: string;
  cap_17f: number | null;
  cap_47f: number | null;
  cop_17f: number | null;
  cop_47f: number | null;
  hspf: number | null;
  cooling_data_type: string;
  cap_95f: number | null;
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
