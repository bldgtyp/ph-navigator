import type { BaseTableSlice } from "../../project_document/table-slice";

export type HeatPumpTableKey = "outdoor-equip" | "indoor-equip" | "outdoor-units" | "indoor-units";

export type HeatingDataType = "cops" | "hspf2";
export type CoolingDataType = "eer2_seer2" | "ieer";

export type HeatPumpOutdoorEquipRow = {
  id: string;
  manufacturer: string | null;
  model_number: string;
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
  manufacturer: string | null;
  model_type: string | null;
  model_number: string;
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

export type HeatPumpsSlice = BaseTableSlice & {
  outdoor_equip: HeatPumpOutdoorEquipRow[];
  indoor_equip: HeatPumpIndoorEquipRow[];
  outdoor_units: HeatPumpOutdoorUnitRow[];
  indoor_units: HeatPumpIndoorUnitRow[];
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
  model_number: string;
  field: PhiusExportWarningField;
  message: string;
};

export type PhiusExportResponse = {
  rows: PhiusExportRow[];
  warnings: PhiusExportWarning[];
  csv: string;
};
