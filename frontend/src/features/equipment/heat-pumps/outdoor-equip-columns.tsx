import {
  OPTION_COLOR_PALETTE,
  type DataTableColumnDef,
  type FieldDef,
  type FieldOption,
} from "../../../shared/ui/data-table";
import type { AssetUrls } from "../../assets/types";
import { heatPumpDatasheetColumn, heatPumpPhotoColumn } from "./attachment-columns";
import {
  HEAT_PUMP_RECORD_ID_SCHEMA_FIELD_KEY,
  heatPumpAttachmentField,
  heatPumpLinkedRecordField,
  heatPumpNumberField,
  heatPumpPowerField,
  heatPumpSelectField,
  heatPumpTagField,
  heatPumpTextField,
} from "./field-defs";
import {
  HEAT_PUMP_LINK_TARGETS,
  incomingOutdoorUnitColumnDef,
  incomingOutdoorUnitIds,
  incomingOutdoorUnitsFieldDef,
} from "./link-fields";
import {
  COOLING_DATA_TYPES,
  HEATING_DATA_TYPES,
  HEAT_PUMP_OPTION_KEYS,
  type HeatPumpOutdoorEquipRow,
  type HeatPumpOutdoorUnitRow,
  type HeatPumpsSlice,
} from "./types";
import { displayNameColumnDef, displayNameFieldDef } from "./name-column";
import { statusColumnDef, statusFieldDef } from "./status-column";
import { HEAT_PUMPS_OUTDOOR_EQUIP_STATUS_OPTION_KEY } from "../types";

// The data-type dropdowns are hard-coded enums, not user-editable lists —
// renaming would silently break Phius paste. Surface them as synthetic
// FieldOptions so the DataTable single-select renderer treats them like
// any other option column. `id === label` because the row stores the
// verbatim calc string.
const HEATING_DATA_TYPE_OPTIONS: FieldOption[] = HEATING_DATA_TYPES.map((value, index) => ({
  id: value,
  label: value,
  color: OPTION_COLOR_PALETTE[index % OPTION_COLOR_PALETTE.length]!,
  order: index,
}));
const COOLING_DATA_TYPE_OPTIONS: FieldOption[] = COOLING_DATA_TYPES.map((value, index) => ({
  id: value,
  label: value,
  color: OPTION_COLOR_PALETTE[index % OPTION_COLOR_PALETTE.length]!,
  order: index,
}));

export const OUTDOOR_EQUIP_DATASHEET_FIELD_KEY = "datasheet_asset_ids";
export const OUTDOOR_EQUIP_PHOTO_FIELD_KEY = "photo_asset_ids";

export function outdoorEquipFieldDefs({
  options,
}: {
  options: HeatPumpsSlice["single_select_options"];
}): FieldDef[] {
  const manufacturer = options[HEAT_PUMP_OPTION_KEYS.manufacturer] ?? [];
  const systemFamily = options[HEAT_PUMP_OPTION_KEYS.systemFamily] ?? [];
  const refrigerant = options[HEAT_PUMP_OPTION_KEYS.refrigerant] ?? [];
  return [
    heatPumpTagField(),
    displayNameFieldDef(),
    heatPumpTextField("model_number", "Model number"),
    heatPumpSelectField("manufacturer", "Manufacturer", manufacturer),
    heatPumpLinkedRecordField({
      field_key: "paired_indoor_equip_id",
      display_name: "Paired indoor equip",
      description: "Indoor equipment row paired with this outdoor equipment model.",
      target_table_path: HEAT_PUMP_LINK_TARGETS.indoorEquip,
      max_links: 1,
    }),
    heatPumpSelectField("system_family", "System family", systemFamily),
    heatPumpSelectField("refrigerant", "Refrigerant", refrigerant),
    heatPumpPowerField("heating_cap_kw_17f", "Heating Capacity at 17F"),
    heatPumpPowerField("heating_cap_kw_47f", "Heating Capacity at 47F"),
    heatPumpSelectField("heating_data_type", "Heating Data Type", HEATING_DATA_TYPE_OPTIONS),
    heatPumpNumberField("heating_cop_17f", "COP 17F"),
    heatPumpNumberField("heating_cop_47f", "COP 47F"),
    heatPumpNumberField(
      "hspf",
      "HSPF/HSPF2",
      "Holds either the legacy HSPF rating or the AHRI-2023 HSPF2 rating; which one is determined by Heating Data Type.",
    ),
    heatPumpPowerField("cooling_cap_kw_95f", "Cooling Capacity at 95F"),
    heatPumpSelectField("cooling_data_type", "Cooling Data Type", COOLING_DATA_TYPE_OPTIONS),
    heatPumpNumberField(
      "eer",
      "EER/EER2",
      "Holds either the legacy EER rating or the AHRI-2023 EER2 rating; which one is determined by Cooling Data Type.",
    ),
    heatPumpNumberField(
      "seer",
      "SEER/SEER2",
      "Holds either the legacy SEER rating or the AHRI-2023 SEER2 rating; which one is determined by Cooling Data Type.",
    ),
    heatPumpNumberField("ieer", "IEER"),
    heatPumpAttachmentField(OUTDOOR_EQUIP_DATASHEET_FIELD_KEY, "Datasheet"),
    heatPumpAttachmentField(OUTDOOR_EQUIP_PHOTO_FIELD_KEY, "Site photos"),
    incomingOutdoorUnitsFieldDef(),
    heatPumpTextField("notes", "Notes"),
    statusFieldDef(options[HEAT_PUMPS_OUTDOOR_EQUIP_STATUS_OPTION_KEY] ?? []),
  ];
}

export const outdoorEquipDefaultHiddenColumns: string[] = [];

export function outdoorEquipColumnDefs({
  projectId,
  isEditor,
  assetUrlById,
  onDatasheetChange,
  onPhotoChange,
  outdoorUnits = [],
  incomingOutdoorUnitIdsByRowId = new Map(),
  pairedIndoorEquipLabelById = new Map(),
  onOutdoorUnitClick,
  onOutdoorUnitsLinkEdit,
}: {
  projectId: string;
  isEditor: boolean;
  assetUrlById: ReadonlyMap<string, AssetUrls>;
  onDatasheetChange: (row: HeatPumpOutdoorEquipRow, next: string[]) => void | Promise<void>;
  onPhotoChange: (row: HeatPumpOutdoorEquipRow, next: string[]) => void | Promise<void>;
  outdoorUnits?: readonly HeatPumpOutdoorUnitRow[];
  incomingOutdoorUnitIdsByRowId?: ReadonlyMap<string, readonly string[]>;
  pairedIndoorEquipLabelById?: ReadonlyMap<string, string>;
  onOutdoorUnitClick?: (rowId: string) => void;
  onOutdoorUnitsLinkEdit?: (row: HeatPumpOutdoorEquipRow) => void;
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
    displayNameColumnDef<HeatPumpOutdoorEquipRow>(),
    {
      id: "tag",
      fieldKey: "tag",
      schemaFieldKey: HEAT_PUMP_RECORD_ID_SCHEMA_FIELD_KEY,
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
      accessor: (row) => (row.paired_indoor_equip_id ? [row.paired_indoor_equip_id] : []),
      measureText: (row) =>
        row.paired_indoor_equip_id
          ? (pairedIndoorEquipLabelById.get(row.paired_indoor_equip_id) ??
            row.paired_indoor_equip_id)
          : "",
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
    heatPumpDatasheetColumn({
      projectId,
      isEditor,
      assetUrlById,
      fieldKey: OUTDOOR_EQUIP_DATASHEET_FIELD_KEY,
      onChange: onDatasheetChange,
    }),
    heatPumpPhotoColumn({
      projectId,
      isEditor,
      assetUrlById,
      fieldKey: OUTDOOR_EQUIP_PHOTO_FIELD_KEY,
      onChange: onPhotoChange,
    }),
    incomingOutdoorUnitColumnDef<HeatPumpOutdoorEquipRow>({
      outdoorUnits,
      getIncomingIds: (row) => incomingOutdoorUnitIds(incomingOutdoorUnitIdsByRowId, row.id),
      onPillClick: onOutdoorUnitClick,
      onActivateEdit: isEditor ? onOutdoorUnitsLinkEdit : undefined,
    }),
    {
      id: "notes",
      fieldKey: "notes",
      header: "Notes",
      accessor: (row) => row.notes,
      defaultWidth: 260,
    },
    statusColumnDef<HeatPumpOutdoorEquipRow>(),
  ];
}
