import type { DataTableColumnDef, FieldDef } from "../../../shared/ui/data-table";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { DATASHEET_ATTACHMENT_CONFIG, sameAttachmentAssetIds } from "../../assets/lib";
import { indoorEquipLabel, optionLabelFromId } from "./lib";
import type { HeatPumpIndoorEquipRow, HeatPumpOutdoorEquipRow } from "./types";

export const OUTDOOR_EQUIP_DATASHEET_FIELD_KEY = "datasheet_asset_ids";

export const outdoorEquipFieldDefs: FieldDef[] = [
  textField("model_number", "Model number", true),
  selectField("manufacturer", "Manufacturer"),
  selectField("paired_indoor_equip_id", "Paired indoor equip"),
  selectField("system_family", "System family"),
  selectField("refrigerant", "Refrigerant"),
  selectField("heating_data_type", "Heating data type", [
    { id: "cops", label: "COPs", color: "blue", order: 0 },
    { id: "hspf2", label: "HSPF2", color: "green", order: 1 },
  ]),
  numberField("heating_cap_kbtuh_17f", "Heat cap 17F"),
  numberField("heating_cap_kbtuh_47f", "Heat cap 47F"),
  numberField("heating_cop_17f", "COP 17F"),
  numberField("heating_cop_47f", "COP 47F"),
  numberField("hspf2", "HSPF2"),
  numberField("hspf", "HSPF"),
  selectField("cooling_data_type", "Cooling data type", [
    { id: "eer2_seer2", label: "EER2 / SEER2", color: "blue", order: 0 },
    { id: "ieer", label: "IEER", color: "green", order: 1 },
  ]),
  numberField("cooling_cap_kbtuh_95f", "Cool cap 95F"),
  numberField("eer2", "EER2"),
  numberField("seer2", "SEER2"),
  numberField("ieer", "IEER"),
  numberField("eer", "EER"),
  numberField("seer", "SEER"),
  {
    field_key: OUTDOOR_EQUIP_DATASHEET_FIELD_KEY,
    field_type: "attachment",
    display_name: "Datasheet",
  },
  textField("notes", "Notes"),
];

export const outdoorEquipDefaultHiddenColumns = ["hspf", "eer", "seer"];

export function outdoorEquipColumnDefs({
  projectId,
  isEditor,
  indoorEquip,
  assetUrlById,
  onDatasheetChange,
}: {
  projectId: string;
  isEditor: boolean;
  indoorEquip: HeatPumpIndoorEquipRow[];
  assetUrlById: Map<string, unknown>;
  onDatasheetChange: (row: HeatPumpOutdoorEquipRow, next: string[]) => void | Promise<void>;
}): DataTableColumnDef<HeatPumpOutdoorEquipRow>[] {
  const indoorById = new Map(indoorEquip.map((row) => [row.id, row]));
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
      accessor: (row) => optionLabelFromId(row.manufacturer),
      defaultWidth: 150,
    },
    {
      id: "paired_indoor_equip_id",
      fieldKey: "paired_indoor_equip_id",
      header: "Paired indoor equip",
      accessor: (row) => indoorEquipLabel(indoorById.get(row.paired_indoor_equip_id ?? "")),
      defaultWidth: 190,
    },
    {
      id: "system_family",
      fieldKey: "system_family",
      header: "System family",
      accessor: (row) => optionLabelFromId(row.system_family),
      defaultWidth: 140,
    },
    {
      id: "refrigerant",
      fieldKey: "refrigerant",
      header: "Refrigerant",
      accessor: (row) => optionLabelFromId(row.refrigerant),
      defaultWidth: 120,
    },
    {
      id: "heating_data_type",
      fieldKey: "heating_data_type",
      header: "Heating data",
      accessor: (row) =>
        row.heating_data_type === "cops" ? "COPs" : row.heating_data_type?.toUpperCase(),
      defaultWidth: 130,
    },
    number("heating_cap_kbtuh_17f", "Heat 17F"),
    number("heating_cap_kbtuh_47f", "Heat 47F"),
    number("heating_cop_17f", "COP 17F"),
    number("heating_cop_47f", "COP 47F"),
    number("hspf2", "HSPF2"),
    number("hspf", "HSPF"),
    {
      id: "cooling_data_type",
      fieldKey: "cooling_data_type",
      header: "Cooling data",
      accessor: (row) =>
        row.cooling_data_type === "eer2_seer2"
          ? "EER2 / SEER2"
          : row.cooling_data_type?.toUpperCase(),
      defaultWidth: 140,
    },
    number("cooling_cap_kbtuh_95f", "Cool 95F"),
    number("eer2", "EER2"),
    number("seer2", "SEER2"),
    number("ieer", "IEER"),
    number("eer", "EER"),
    number("seer", "SEER"),
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
