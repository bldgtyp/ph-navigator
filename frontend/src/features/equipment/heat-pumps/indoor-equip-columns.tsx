import type { DataTableColumnDef, FieldDef } from "../../../shared/ui/data-table";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { DATASHEET_ATTACHMENT_CONFIG, sameAttachmentAssetIds } from "../../assets/lib";
import { optionLabelFromId } from "./lib";
import type { HeatPumpIndoorEquipRow } from "./types";

export const INDOOR_EQUIP_DATASHEET_FIELD_KEY = "datasheet_asset_ids";

export const indoorEquipFieldDefs: FieldDef[] = [
  textField("model_number", "Model number", true),
  selectField("manufacturer", "Manufacturer"),
  selectField("model_type", "Model type"),
  selectField("install_type", "Install type"),
  numberField("nominal_tons", "Nominal tons"),
  numberField("fan_speed_cfm", "Fan speed (CFM)"),
  numberField("cooling_btuh", "Cooling Btu/h"),
  numberField("heating_btuh_47f", "Heating Btu/h @ 47F"),
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
      id: "manufacturer",
      fieldKey: "manufacturer",
      header: "Manufacturer",
      accessor: (row) => optionLabelFromId(row.manufacturer),
      defaultWidth: 150,
    },
    {
      id: "model_type",
      fieldKey: "model_type",
      header: "Model type",
      accessor: (row) => optionLabelFromId(row.model_type),
      defaultWidth: 130,
    },
    {
      id: "model_number",
      fieldKey: "model_number",
      header: "Model number",
      accessor: (row) => row.model_number,
      defaultWidth: 160,
    },
    {
      id: "install_type",
      fieldKey: "install_type",
      header: "Install type",
      accessor: (row) => optionLabelFromId(row.install_type),
      defaultWidth: 160,
    },
    number("nominal_tons", "Nominal tons"),
    number("fan_speed_cfm", "Fan CFM"),
    number("cooling_btuh", "Cool Btu/h", 130),
    number("heating_btuh_47f", "Heat 47F Btu/h", 140),
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

function selectField(
  field_key: string,
  display_name: string,
  options: FieldDef["options"] = [],
): FieldDef {
  return { field_key, field_type: "single_select", display_name, options };
}
