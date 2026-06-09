import type { DataTableColumnDef, FieldDef } from "../../../shared/ui/data-table";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { DATASHEET_ATTACHMENT_CONFIG, sameAttachmentAssetIds } from "../../assets/lib";
import { optionLabelFromId, outdoorEquipLabel } from "./lib";
import type { HeatPumpOutdoorEquipRow, HeatPumpOutdoorUnitRow } from "./types";

export const OUTDOOR_UNIT_DATASHEET_FIELD_KEY = "datasheet_asset_ids";

export const outdoorUnitFieldDefs: FieldDef[] = [
  { field_key: "tag", field_type: "text", display_name: "Tag", required: true },
  {
    field_key: "outdoor_equip_id",
    field_type: "single_select",
    display_name: "Equipment",
    options: [],
  },
  { field_key: "building_zone", field_type: "single_select", display_name: "Zone", options: [] },
  {
    field_key: OUTDOOR_UNIT_DATASHEET_FIELD_KEY,
    field_type: "attachment",
    display_name: "Datasheet",
  },
  { field_key: "notes", field_type: "text", display_name: "Notes" },
];

export const outdoorUnitDefaultHiddenColumns: string[] = ["notes"];

export function outdoorUnitColumnDefs({
  projectId,
  isEditor,
  outdoorEquip,
  assetUrlById,
  onDatasheetChange,
}: {
  projectId: string;
  isEditor: boolean;
  outdoorEquip: HeatPumpOutdoorEquipRow[];
  assetUrlById: Map<string, unknown>;
  onDatasheetChange: (row: HeatPumpOutdoorUnitRow, next: string[]) => void | Promise<void>;
}): DataTableColumnDef<HeatPumpOutdoorUnitRow>[] {
  const equipById = new Map(outdoorEquip.map((row) => [row.id, row]));
  return [
    {
      id: "tag",
      fieldKey: "tag",
      header: "Tag",
      accessor: (row) => row.tag,
      defaultWidth: 140,
    },
    {
      id: "outdoor_equip_id",
      fieldKey: "outdoor_equip_id",
      header: "Equipment",
      accessor: (row) => outdoorEquipLabel(equipById.get(row.outdoor_equip_id) ?? null),
      defaultWidth: 220,
    },
    {
      id: "building_zone",
      fieldKey: "building_zone",
      header: "Zone",
      accessor: (row) => optionLabelFromId(row.building_zone),
      defaultWidth: 140,
    },
    {
      id: OUTDOOR_UNIT_DATASHEET_FIELD_KEY,
      fieldKey: OUTDOOR_UNIT_DATASHEET_FIELD_KEY,
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
