import type { DataTableColumnDef, FieldDef } from "../../../shared/ui/data-table";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { DATASHEET_ATTACHMENT_CONFIG, sameAttachmentAssetIds } from "../../assets/lib";
import { indoorEquipLabel, optionLabelFromId, outdoorUnitLabel } from "./lib";
import type {
  HeatPumpIndoorEquipRow,
  HeatPumpIndoorUnitRow,
  HeatPumpOutdoorUnitRow,
} from "./types";

export const INDOOR_UNIT_DATASHEET_FIELD_KEY = "datasheet_asset_ids";

export const indoorUnitFieldDefs: FieldDef[] = [
  { field_key: "tag", field_type: "text", display_name: "Tag", required: true },
  {
    field_key: "indoor_equip_id",
    field_type: "single_select",
    display_name: "Equipment",
    options: [],
  },
  {
    field_key: "outdoor_unit_id",
    field_type: "single_select",
    display_name: "Outdoor unit",
    options: [],
  },
  { field_key: "floor_level", field_type: "single_select", display_name: "Floor", options: [] },
  { field_key: "area_served", field_type: "text", display_name: "Area served" },
  {
    field_key: "linked_erv_unit_id",
    field_type: "single_select",
    display_name: "Linked ERV",
    options: [],
  },
  {
    field_key: INDOOR_UNIT_DATASHEET_FIELD_KEY,
    field_type: "attachment",
    display_name: "Datasheet",
  },
  { field_key: "notes", field_type: "text", display_name: "Notes" },
];

export const indoorUnitDefaultHiddenColumns: string[] = ["linked_erv_unit_id", "notes"];

export function indoorUnitColumnDefs({
  projectId,
  isEditor,
  indoorEquip,
  outdoorUnits,
  assetUrlById,
  onDatasheetChange,
}: {
  projectId: string;
  isEditor: boolean;
  indoorEquip: HeatPumpIndoorEquipRow[];
  outdoorUnits: HeatPumpOutdoorUnitRow[];
  assetUrlById: Map<string, unknown>;
  onDatasheetChange: (row: HeatPumpIndoorUnitRow, next: string[]) => void | Promise<void>;
}): DataTableColumnDef<HeatPumpIndoorUnitRow>[] {
  const equipById = new Map(indoorEquip.map((row) => [row.id, row]));
  const outdoorById = new Map(outdoorUnits.map((row) => [row.id, row]));
  return [
    {
      id: "tag",
      fieldKey: "tag",
      header: "Tag",
      accessor: (row) => row.tag,
      defaultWidth: 140,
    },
    {
      id: "indoor_equip_id",
      fieldKey: "indoor_equip_id",
      header: "Equipment",
      accessor: (row) => indoorEquipLabel(equipById.get(row.indoor_equip_id) ?? null),
      defaultWidth: 220,
    },
    {
      id: "outdoor_unit_id",
      fieldKey: "outdoor_unit_id",
      header: "Outdoor unit",
      accessor: (row) =>
        row.outdoor_unit_id ? outdoorUnitLabel(outdoorById.get(row.outdoor_unit_id) ?? null) : "",
      defaultWidth: 160,
    },
    {
      id: "floor_level",
      fieldKey: "floor_level",
      header: "Floor",
      accessor: (row) => optionLabelFromId(row.floor_level),
      defaultWidth: 120,
    },
    {
      id: "area_served",
      fieldKey: "area_served",
      header: "Area served",
      accessor: (row) => row.area_served,
      defaultWidth: 200,
    },
    {
      id: "linked_erv_unit_id",
      fieldKey: "linked_erv_unit_id",
      header: "Linked ERV",
      accessor: (row) => row.linked_erv_unit_id ?? "",
      defaultWidth: 160,
    },
    {
      id: INDOOR_UNIT_DATASHEET_FIELD_KEY,
      fieldKey: INDOOR_UNIT_DATASHEET_FIELD_KEY,
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
