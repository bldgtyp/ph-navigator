import { useMemo, type CSSProperties } from "react";
import {
  DataTable,
  type DataTableColumnDef,
  type DataTableProps,
  type FieldDef,
  type ViewState,
} from "../../../shared/ui/data-table";
import { singleSelectOption } from "../../../shared/ui/data-table/lib";
import { sortedRooms } from "../lib";
import {
  ROOM_BUILDING_ZONE_KEY,
  ROOM_FLOOR_LEVEL_KEY,
  type RoomRow,
  type RoomsSlice,
} from "../types";

export function RoomsTable({
  roomsSlice,
  isEditor,
  onEdit,
  view,
  onViewChange,
  onWrite,
  buildEmptyRow,
  generateRowId,
  sessionKey,
  overflowMenuActions,
  footerAction,
}: {
  roomsSlice: RoomsSlice;
  isEditor: boolean;
  onEdit: (room: RoomRow) => void;
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  onWrite: NonNullable<DataTableProps<RoomRow>["onWrite"]>;
  buildEmptyRow?: DataTableProps<RoomRow>["buildEmptyRow"];
  generateRowId?: DataTableProps<RoomRow>["generateRowId"];
  sessionKey?: DataTableProps<RoomRow>["sessionKey"];
  overflowMenuActions?: DataTableProps<RoomRow>["overflowMenuActions"];
  footerAction?: DataTableProps<RoomRow>["footerAction"];
}) {
  const sortedRows = useMemo(() => sortedRooms(roomsSlice.rooms), [roomsSlice.rooms]);
  const floorOptions = roomsSlice.single_select_options[ROOM_FLOOR_LEVEL_KEY];
  const zoneOptions = roomsSlice.single_select_options[ROOM_BUILDING_ZONE_KEY];
  const fieldDefs = useMemo<FieldDef[]>(
    () => [
      { field_key: "number", field_type: "text", display_name: "Number", required: true },
      { field_key: "name", field_type: "text", display_name: "Name", required: true },
      {
        field_key: ROOM_FLOOR_LEVEL_KEY,
        field_type: "single_select",
        display_name: "Floor",
        required: true,
        options: floorOptions,
      },
      {
        field_key: ROOM_BUILDING_ZONE_KEY,
        field_type: "single_select",
        display_name: "Zone",
        options: zoneOptions,
      },
      { field_key: "num_people", field_type: "number", display_name: "People" },
      { field_key: "num_bedrooms", field_type: "number", display_name: "Bedrooms" },
      { field_key: "icfa_factor", field_type: "number", display_name: "iCFA" },
      { field_key: "erv_unit_ids", field_type: "text", display_name: "ERVs", read_only: true },
    ],
    [floorOptions, zoneOptions],
  );
  const fieldDefByKey = useMemo(
    () => new Map(fieldDefs.map((fieldDef) => [fieldDef.field_key, fieldDef])),
    [fieldDefs],
  );
  const columns = useMemo<DataTableColumnDef<RoomRow>[]>(
    () => [
      {
        id: "number",
        fieldKey: "number",
        header: "Number",
        accessor: (room) => room.number,
        width: 120,
      },
      {
        id: "name",
        fieldKey: "name",
        header: "Name",
        accessor: (room) => room.name,
      },
      {
        id: "floor_level",
        fieldKey: ROOM_FLOOR_LEVEL_KEY,
        header: "Floor",
        accessor: (room) => room.floor_level,
        render: (room) => optionPill(room.floor_level, fieldDefByKey.get(ROOM_FLOOR_LEVEL_KEY)),
      },
      {
        id: "building_zone",
        fieldKey: ROOM_BUILDING_ZONE_KEY,
        header: "Zone",
        accessor: (room) => room.building_zone,
        render: (room) => optionPill(room.building_zone, fieldDefByKey.get(ROOM_BUILDING_ZONE_KEY)),
      },
      {
        id: "num_people",
        fieldKey: "num_people",
        header: "People",
        accessor: (room) => room.num_people,
        className: "numeric-cell",
      },
      {
        id: "num_bedrooms",
        fieldKey: "num_bedrooms",
        header: "Bedrooms",
        accessor: (room) => room.num_bedrooms,
        className: "numeric-cell",
      },
      {
        id: "icfa_factor",
        fieldKey: "icfa_factor",
        header: "iCFA",
        accessor: (room) => room.icfa_factor,
        render: (room) => room.icfa_factor.toFixed(2),
        className: "numeric-cell",
      },
      {
        id: "erv_unit_ids",
        fieldKey: "erv_unit_ids",
        header: "ERVs",
        accessor: (room) => room.erv_unit_ids.join(", "),
        render: (room) =>
          room.erv_unit_ids.length ? (
            room.erv_unit_ids.join(", ")
          ) : (
            <span className="muted-cell">None</span>
          ),
      },
    ],
    [fieldDefByKey],
  );

  return (
    <DataTable
      rows={sortedRows}
      columnDefs={columns}
      fieldDefs={fieldDefs}
      getRowId={(room) => room.id}
      emptyMessage={isEditor ? "No rooms yet." : "No rooms are published in this version."}
      readOnly={!isEditor}
      view={view}
      onViewChange={onViewChange}
      onWrite={onWrite}
      buildEmptyRow={buildEmptyRow}
      generateRowId={generateRowId}
      sessionKey={sessionKey}
      onRowOpen={isEditor ? onEdit : undefined}
      overflowMenuActions={overflowMenuActions}
      footerAction={footerAction}
    />
  );
}

function optionPill(value: string | null, fieldDef: FieldDef | undefined) {
  const option = singleSelectOption(value, fieldDef);
  const label = value ? (option?.label ?? "Missing option") : "Unassigned";
  const applyColor = option && fieldDef?.colorCodeOptions !== false;
  return (
    <span
      className={
        option ? "single-select-pill" : value ? "single-select-pill missing" : "muted-cell"
      }
      style={applyColor ? ({ "--option-color": option.color } as CSSProperties) : undefined}
    >
      {label}
    </span>
  );
}
