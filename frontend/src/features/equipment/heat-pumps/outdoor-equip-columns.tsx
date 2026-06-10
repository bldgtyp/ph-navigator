import type { DataTableColumnDef, FieldDef, FieldOption } from "../../../shared/ui/data-table";
import type { NumberUnitsConfig } from "../../../lib/units";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { DATASHEET_ATTACHMENT_CONFIG, sameAttachmentAssetIds } from "../../assets/lib";
import { indoorEquipLabel } from "./lib";
import {
  COOLING_DATA_TYPES,
  HEATING_DATA_TYPES,
  HEAT_PUMP_OPTION_KEYS,
  type HeatPumpIndoorEquipRow,
  type HeatPumpOutdoorEquipRow,
  type HeatPumpsSlice,
} from "./types";

// The data-type dropdowns are hard-coded enums, not user-editable lists —
// renaming would silently break Phius paste. Surface them as synthetic
// FieldOptions so the DataTable single-select renderer treats them like
// any other option column. `id === label` because the row stores the
// verbatim calc string.
// Neutral chip color shared by synthetic FieldOption lists in this slice
// (paired-indoor picker + data-type discriminators). Named-color form so
// the `check:hex` lint stays clean.
const SYNTHETIC_OPTION_CHIP_COLOR = "slategray";
const HEATING_DATA_TYPE_OPTIONS: FieldOption[] = HEATING_DATA_TYPES.map((value, index) => ({
  id: value,
  label: value,
  color: SYNTHETIC_OPTION_CHIP_COLOR,
  order: index,
}));
const COOLING_DATA_TYPE_OPTIONS: FieldOption[] = COOLING_DATA_TYPES.map((value, index) => ({
  id: value,
  label: value,
  color: SYNTHETIC_OPTION_CHIP_COLOR,
  order: index,
}));

export const OUTDOOR_EQUIP_DATASHEET_FIELD_KEY = "datasheet_asset_ids";

// Heat-pump capacity is stored canonically in kW; the DataTable resolves
// the live header label and parses/formats cell input via the global
// SI/IP toggle. Phius export converts back to kBtu/h on the way out.
const POWER_UNITS: NumberUnitsConfig = {
  mode: "fixed",
  unit_type: "power",
  si_unit: "kw",
  ip_unit: "kbtu_h",
  precision_si: 2,
  precision_ip: 1,
};

export function outdoorEquipFieldDefs({
  options,
  indoorEquip,
}: {
  options: HeatPumpsSlice["single_select_options"];
  indoorEquip: readonly HeatPumpIndoorEquipRow[];
}): FieldDef[] {
  const manufacturer = options[HEAT_PUMP_OPTION_KEYS.manufacturer] ?? [];
  const systemFamily = options[HEAT_PUMP_OPTION_KEYS.systemFamily] ?? [];
  const refrigerant = options[HEAT_PUMP_OPTION_KEYS.refrigerant] ?? [];
  // The paired-indoor pickers (cell popover + modal) read from a synthetic
  // option list whose `id` is the row id and `label` is `indoorEquipLabel`.
  // Mirroring the manufacturer pattern lets the same DataTable cell renderer
  // resolve the label without a row-shape-specific code path.
  const pairedIndoor: FieldOption[] = indoorEquip.map((row, index) => ({
    id: row.id,
    label: indoorEquipLabel(row, manufacturer),
    color: SYNTHETIC_OPTION_CHIP_COLOR,
    order: index,
  }));
  return [
    textField("tag", "Tag", true),
    textField("model_number", "Model number"),
    selectField("manufacturer", "Manufacturer", manufacturer),
    selectField("paired_indoor_equip_id", "Paired indoor equip", pairedIndoor),
    selectField("system_family", "System family", systemFamily),
    selectField("refrigerant", "Refrigerant", refrigerant),
    powerField("heating_cap_kw_17f", "Heating Capacity at 17F"),
    powerField("heating_cap_kw_47f", "Heating Capacity at 47F"),
    selectField("heating_data_type", "Heating Data Type", HEATING_DATA_TYPE_OPTIONS),
    numberField("heating_cop_17f", "COP 17F"),
    numberField("heating_cop_47f", "COP 47F"),
    numberField(
      "hspf",
      "HSPF/HSPF2",
      "Holds either the legacy HSPF rating or the AHRI-2023 HSPF2 rating; which one is determined by Heating Data Type.",
    ),
    powerField("cooling_cap_kw_95f", "Cooling Capacity at 95F"),
    selectField("cooling_data_type", "Cooling Data Type", COOLING_DATA_TYPE_OPTIONS),
    numberField(
      "eer",
      "EER/EER2",
      "Holds either the legacy EER rating or the AHRI-2023 EER2 rating; which one is determined by Cooling Data Type.",
    ),
    numberField(
      "seer",
      "SEER/SEER2",
      "Holds either the legacy SEER rating or the AHRI-2023 SEER2 rating; which one is determined by Cooling Data Type.",
    ),
    numberField("ieer", "IEER"),
    {
      field_key: OUTDOOR_EQUIP_DATASHEET_FIELD_KEY,
      field_type: "attachment",
      display_name: "Datasheet",
    },
    textField("notes", "Notes"),
  ];
}

export const outdoorEquipDefaultHiddenColumns: string[] = [];

export function outdoorEquipColumnDefs({
  projectId,
  isEditor,
  assetUrlById,
  onDatasheetChange,
}: {
  projectId: string;
  isEditor: boolean;
  // Single-select column labels are resolved from FieldDef.options inside
  // the DataTable, so this builder no longer needs `options` or the
  // related `indoorEquip` list — both flow through `outdoorEquipFieldDefs`.
  assetUrlById: Map<string, unknown>;
  onDatasheetChange: (row: HeatPumpOutdoorEquipRow, next: string[]) => void | Promise<void>;
}): DataTableColumnDef<HeatPumpOutdoorEquipRow>[] {
  const number = (fieldKey: keyof HeatPumpOutdoorEquipRow, header: string, width = 110) => ({
    id: fieldKey,
    fieldKey,
    header,
    accessor: (row: HeatPumpOutdoorEquipRow) => row[fieldKey],
    defaultWidth: width,
    className: "numeric-cell",
  });
  return [
    {
      id: "tag",
      fieldKey: "tag",
      header: "Tag",
      accessor: (row) => row.tag,
      defaultWidth: 120,
    },
    {
      id: "model_number",
      fieldKey: "model_number",
      header: "Model number",
      accessor: (row) => row.model_number,
      defaultWidth: 160,
    },
    {
      id: "manufacturer",
      fieldKey: "manufacturer",
      header: "Manufacturer",
      // DataTable's formatDisplayCellValue takes the accessor's return value
      // and looks it up against FieldDef.options by `id`, so single-select
      // accessors must yield the raw option id. The label resolution then
      // happens once, inside the cell renderer.
      accessor: (row) => row.manufacturer,
      defaultWidth: 150,
    },
    {
      id: "paired_indoor_equip_id",
      fieldKey: "paired_indoor_equip_id",
      header: "Paired indoor equip",
      accessor: (row) => row.paired_indoor_equip_id,
      defaultWidth: 190,
    },
    {
      id: "system_family",
      fieldKey: "system_family",
      header: "System family",
      accessor: (row) => row.system_family,
      defaultWidth: 140,
    },
    {
      id: "refrigerant",
      fieldKey: "refrigerant",
      header: "Refrigerant",
      accessor: (row) => row.refrigerant,
      defaultWidth: 120,
    },
    // Capacity columns: header label here is title-only — the live unit
    // suffix (kW / kBtu/h) is rendered by the DataTable header from the
    // FieldDef's numberUnits config. Accessors yield raw canonical kW.
    number("heating_cap_kw_17f", "Heating Capacity at 17F", 180),
    number("heating_cap_kw_47f", "Heating Capacity at 47F", 180),
    {
      id: "heating_data_type",
      fieldKey: "heating_data_type",
      header: "Heating Data Type",
      accessor: (row) => row.heating_data_type,
      defaultWidth: 160,
    },
    number("heating_cop_17f", "COP 17F"),
    number("heating_cop_47f", "COP 47F"),
    number("hspf", "HSPF/HSPF2", 130),
    number("cooling_cap_kw_95f", "Cooling Capacity at 95F", 180),
    {
      id: "cooling_data_type",
      fieldKey: "cooling_data_type",
      header: "Cooling Data Type",
      accessor: (row) => row.cooling_data_type,
      defaultWidth: 160,
    },
    number("eer", "EER/EER2", 120),
    number("seer", "SEER/SEER2", 120),
    number("ieer", "IEER"),
    {
      id: OUTDOOR_EQUIP_DATASHEET_FIELD_KEY,
      fieldKey: OUTDOOR_EQUIP_DATASHEET_FIELD_KEY,
      header: "Datasheet",
      accessor: (row) => row.datasheet_asset_ids.join(","),
      render: (row) => (
        <AttachmentCell
          projectId={projectId}
          value={row.datasheet_asset_ids}
          config={DATASHEET_ATTACHMENT_CONFIG}
          readOnly={!isEditor}
          assetUrlById={assetUrlById as never}
          onChange={(next) => {
            if (sameAttachmentAssetIds(row.datasheet_asset_ids, next)) return;
            return onDatasheetChange(row, next);
          }}
        />
      ),
      measureText: (row) => `${row.datasheet_asset_ids.length} attachments`,
      defaultWidth: 260,
    },
    {
      id: "notes",
      fieldKey: "notes",
      header: "Notes",
      accessor: (row) => row.notes,
      defaultWidth: 260,
    },
  ];
}

function textField(field_key: string, display_name: string, required = false): FieldDef {
  return { field_key, field_type: "text", display_name, required };
}

function numberField(field_key: string, display_name: string, description?: string): FieldDef {
  return { field_key, field_type: "number", display_name, ...(description ? { description } : {}) };
}

function powerField(field_key: string, display_name: string): FieldDef {
  return { field_key, field_type: "number", display_name, numberUnits: POWER_UNITS };
}

function selectField(
  field_key: string,
  display_name: string,
  options: FieldDef["options"] = [],
): FieldDef {
  return { field_key, field_type: "single_select", display_name, options };
}
