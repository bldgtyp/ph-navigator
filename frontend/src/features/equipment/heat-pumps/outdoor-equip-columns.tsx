import {
  OPTION_COLOR_PALETTE,
  incomingLinkColumn,
  type DataTableColumnDef,
  type FieldDef,
  type FieldOption,
} from "../../../shared/ui/data-table";
import type { NumberUnitsConfig } from "../../../lib/units";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { DATASHEET_ATTACHMENT_CONFIG, sameAttachmentAssetIds } from "../../assets/lib";
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
}: {
  options: HeatPumpsSlice["single_select_options"];
}): FieldDef[] {
  const manufacturer = options[HEAT_PUMP_OPTION_KEYS.manufacturer] ?? [];
  const systemFamily = options[HEAT_PUMP_OPTION_KEYS.systemFamily] ?? [];
  const refrigerant = options[HEAT_PUMP_OPTION_KEYS.refrigerant] ?? [];
  return [
    textField("tag", "Tag", true),
    textField("model_number", "Model number"),
    selectField("manufacturer", "Manufacturer", manufacturer),
    pairedIndoorEquipField(),
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
    incomingOutdoorUnitsFieldDef(),
    textField("notes", "Notes"),
  ];
}

export const outdoorEquipDefaultHiddenColumns: string[] = [];

export function outdoorEquipColumnDefs({
  projectId,
  isEditor,
  assetUrlById,
  onDatasheetChange,
  outdoorUnits = [],
  incomingOutdoorUnitIdsByRowId = new Map(),
  pairedIndoorEquipIdsByRowId = new Map(),
  pairedIndoorEquipLabelById = new Map(),
  onPairedIndoorEquipClick,
  onOutdoorUnitClick,
  onOutdoorUnitsLinkEdit,
}: {
  projectId: string;
  isEditor: boolean;
  assetUrlById: Map<string, unknown>;
  onDatasheetChange: (row: HeatPumpOutdoorEquipRow, next: string[]) => void | Promise<void>;
  outdoorUnits?: readonly HeatPumpOutdoorUnitRow[];
  incomingOutdoorUnitIdsByRowId?: ReadonlyMap<string, readonly string[]>;
  pairedIndoorEquipIdsByRowId?: ReadonlyMap<string, readonly string[]>;
  pairedIndoorEquipLabelById?: ReadonlyMap<string, string>;
  onPairedIndoorEquipClick?: (rowId: string) => void;
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
    incomingLinkColumn<HeatPumpOutdoorEquipRow>({
      id: "paired_indoor_equip_id",
      fieldKey: "paired_indoor_equip_id",
      header: "Paired indoor equip",
      getIncomingIds: (row) => pairedIndoorEquipIdsByRowId.get(row.id) ?? [],
      resolveLabel: (rowId) => pairedIndoorEquipLabelById.get(rowId) ?? null,
      onPillClick: onPairedIndoorEquipClick,
      accessorValue: "ids",
      defaultWidth: 190,
    }),
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

function pairedIndoorEquipField(): FieldDef {
  return {
    field_key: "paired_indoor_equip_id",
    field_type: "linked_record",
    display_name: "Paired indoor equip",
    description: "Derived from Units - Indoor links to outdoor units.",
    read_only: true,
    linked_record_config: {
      target_table_path: [...HEAT_PUMP_LINK_TARGETS.indoorEquip],
      max_links: null,
    },
  };
}

function selectField(
  field_key: string,
  display_name: string,
  options: FieldDef["options"] = [],
): FieldDef {
  return { field_key, field_type: "single_select", display_name, options };
}
