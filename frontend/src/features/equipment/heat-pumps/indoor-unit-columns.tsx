import type { DataTableColumnDef, FieldDef } from "../../../shared/ui/data-table";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { DATASHEET_ATTACHMENT_CONFIG, sameAttachmentAssetIds } from "../../assets/lib";
import type { RoomRow, VentilatorRow } from "../types";
import {
  HEAT_PUMP_RECORD_ID_SCHEMA_FIELD_KEY,
  heatPumpAttachmentField,
  heatPumpLinkedRecordField,
  heatPumpTagField,
  heatPumpTextField,
} from "./field-defs";
import { roomLabel, ventilatorLabel } from "./lib";
import { HEAT_PUMP_LINK_TARGETS } from "./link-fields";
import { type HeatPumpIndoorUnitRow } from "./types";

export const INDOOR_UNIT_DATASHEET_FIELD_KEY = "datasheet_asset_ids";

export function indoorUnitFieldDefs(): FieldDef[] {
  return [
    heatPumpTagField(),
    heatPumpLinkedRecordField({
      field_key: "indoor_equip_id",
      display_name: "Equipment",
      required: true,
      target_table_path: HEAT_PUMP_LINK_TARGETS.indoorEquip,
      max_links: 1,
    }),
    heatPumpLinkedRecordField({
      field_key: "outdoor_unit_id",
      display_name: "Outdoor unit",
      target_table_path: HEAT_PUMP_LINK_TARGETS.outdoorUnits,
      max_links: 1,
    }),
    heatPumpLinkedRecordField({
      field_key: "served_room_ids",
      display_name: "Rooms",
      description: "Rooms this indoor unit serves.",
      target_table_path: ["rooms"],
      max_links: null,
    }),
    heatPumpLinkedRecordField({
      field_key: "linked_erv_unit_id",
      display_name: "Linked ERV",
      description: "Ventilator / ERV containing or associated with this indoor unit.",
      target_table_path: HEAT_PUMP_LINK_TARGETS.ventilators,
      max_links: 1,
    }),
    heatPumpAttachmentField(INDOOR_UNIT_DATASHEET_FIELD_KEY, "Datasheet"),
    heatPumpTextField("notes", "Notes"),
  ];
}

export const indoorUnitDefaultHiddenColumns: string[] = ["notes"];

export function indoorUnitColumnDefs({
  projectId,
  isEditor,
  rooms,
  ventilators,
  assetUrlById,
  onDatasheetChange,
}: {
  projectId: string;
  isEditor: boolean;
  // Target-table rows are required to resolve stored link ids to
  // human-readable, comma-joined cell values.
  rooms: readonly RoomRow[];
  ventilators: readonly VentilatorRow[];
  assetUrlById: Map<string, unknown>;
  onDatasheetChange: (row: HeatPumpIndoorUnitRow, next: string[]) => void | Promise<void>;
}): DataTableColumnDef<HeatPumpIndoorUnitRow>[] {
  const roomsById = new Map(rooms.map((room) => [room.id, room]));
  const ventilatorsById = new Map(ventilators.map((ventilator) => [ventilator.id, ventilator]));
  const formatServedRooms = (row: HeatPumpIndoorUnitRow): string =>
    row.served_room_ids
      .map((id) => {
        const room = roomsById.get(id);
        return room ? roomLabel(room) : id;
      })
      .filter(Boolean)
      .join(", ");
  const formatLinkedVentilator = (row: HeatPumpIndoorUnitRow): string => {
    if (!row.linked_erv_unit_id) return "";
    const ventilator = ventilatorsById.get(row.linked_erv_unit_id);
    return ventilator ? ventilatorLabel(ventilator) : row.linked_erv_unit_id;
  };
  return [
    {
      id: "tag",
      fieldKey: "tag",
      schemaFieldKey: HEAT_PUMP_RECORD_ID_SCHEMA_FIELD_KEY,
      header: "Tag",
      accessor: (row) => row.tag,
      defaultWidth: 140,
    },
    {
      id: "indoor_equip_id",
      fieldKey: "indoor_equip_id",
      header: "Equipment",
      accessor: (row) => [row.indoor_equip_id],
      defaultWidth: 220,
    },
    {
      id: "outdoor_unit_id",
      fieldKey: "outdoor_unit_id",
      header: "Outdoor unit",
      accessor: (row) => (row.outdoor_unit_id ? [row.outdoor_unit_id] : []),
      defaultWidth: 160,
    },
    {
      id: "served_room_ids",
      fieldKey: "served_room_ids",
      header: "Rooms",
      // linked_record cell reads the id list directly; `measureText`
      // drives auto-width sizing from the comma-joined room labels.
      accessor: (row) => row.served_room_ids,
      measureText: formatServedRooms,
      defaultWidth: 220,
    },
    {
      id: "linked_erv_unit_id",
      fieldKey: "linked_erv_unit_id",
      header: "Linked ERV",
      accessor: (row) => (row.linked_erv_unit_id ? [row.linked_erv_unit_id] : []),
      measureText: formatLinkedVentilator,
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
