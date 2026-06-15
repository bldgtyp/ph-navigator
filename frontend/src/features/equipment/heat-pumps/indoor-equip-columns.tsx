import type { DataTableColumnDef, FieldDef } from "../../../shared/ui/data-table";
import type { NumberUnitsConfig } from "../../../lib/units";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { DATASHEET_ATTACHMENT_CONFIG, sameAttachmentAssetIds } from "../../assets/lib";
import { HEAT_PUMP_OPTION_KEYS, type HeatPumpIndoorEquipRow, type HeatPumpsSlice } from "./types";

export const INDOOR_EQUIP_DATASHEET_FIELD_KEY = "datasheet_asset_ids";

// Indoor heat-pump capacity fields retain their legacy *_btuh keys for
// document compatibility, but the stored value is canonical kW.
const POWER_UNITS: NumberUnitsConfig = {
  mode: "fixed",
  unit_type: "power",
  si_unit: "kw",
  ip_unit: "kbtu_h",
  precision_si: 2,
  precision_ip: 1,
};

export function indoorEquipFieldDefs(options: HeatPumpsSlice["single_select_options"]): FieldDef[] {
  const manufacturer = options[HEAT_PUMP_OPTION_KEYS.manufacturer] ?? [];
  const modelType = options[HEAT_PUMP_OPTION_KEYS.modelType] ?? [];
  const installType = options[HEAT_PUMP_OPTION_KEYS.installType] ?? [];
  return [
    textField("tag", "Tag", true),
    textField("model_number", "Model number"),
    selectField("manufacturer", "Manufacturer", manufacturer),
    selectField("model_type", "Model type", modelType),
    selectField("install_type", "Install type", installType),
    numberField("nominal_tons", "Nominal tons"),
    numberField("fan_speed_cfm", "Fan speed (CFM)"),
    powerField("cooling_btuh", "Cooling Capacity"),
    powerField("heating_btuh_47f", "Heating Capacity"),
    numberField("heating_btuh_17f", "Heating Btu/h @ 17F"),
    numberField("heating_cop", "Heating COP"),
    numberField("seer", "SEER"),
    numberField("eer", "EER"),
    numberField("hspf", "HSPF"),
    {
      field_key: INDOOR_EQUIP_DATASHEET_FIELD_KEY,
      field_type: "attachment",
      display_name: "Datasheet",
    },
    textField("notes", "Notes"),
  ];
}

// Default-hidden columns per PRD §4.3 / phase-02 acceptance #2.
export const indoorEquipDefaultHiddenColumns = [
  "fan_speed_cfm",
  "heating_btuh_17f",
  "heating_cop",
  "seer",
  "eer",
  "hspf",
  "notes",
];

export function indoorEquipColumnDefs({
  projectId,
  isEditor,
  assetUrlById,
  onDatasheetChange,
}: {
  projectId: string;
  isEditor: boolean;
  assetUrlById: Map<string, unknown>;
  onDatasheetChange: (row: HeatPumpIndoorEquipRow, next: string[]) => void | Promise<void>;
}): DataTableColumnDef<HeatPumpIndoorEquipRow>[] {
  const number = (fieldKey: keyof HeatPumpIndoorEquipRow, header: string, width = 110) => ({
    id: fieldKey,
    fieldKey,
    header,
    accessor: (row: HeatPumpIndoorEquipRow) => row[fieldKey],
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
      // Accessor returns the raw option id — DataTable's
      // `formatDisplayCellValue` resolves the label from FieldDef.options.
      accessor: (row) => row.manufacturer,
      defaultWidth: 150,
    },
    {
      id: "model_type",
      fieldKey: "model_type",
      header: "Model type",
      accessor: (row) => row.model_type,
      defaultWidth: 130,
    },
    {
      id: "install_type",
      fieldKey: "install_type",
      header: "Install type",
      accessor: (row) => row.install_type,
      defaultWidth: 160,
    },
    number("nominal_tons", "Nominal tons"),
    number("fan_speed_cfm", "Fan CFM"),
    number("cooling_btuh", "Cooling Capacity", 160),
    number("heating_btuh_47f", "Heating Capacity", 160),
    number("heating_btuh_17f", "Heat 17F Btu/h", 140),
    number("heating_cop", "Heat COP"),
    number("seer", "SEER"),
    number("eer", "EER"),
    number("hspf", "HSPF"),
    {
      id: INDOOR_EQUIP_DATASHEET_FIELD_KEY,
      fieldKey: INDOOR_EQUIP_DATASHEET_FIELD_KEY,
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

function numberField(field_key: string, display_name: string): FieldDef {
  return { field_key, field_type: "number", display_name };
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
