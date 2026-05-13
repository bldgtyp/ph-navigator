import { useMemo } from "react";
import {
  DataTable,
  type DataTableColumnDef,
  type FieldDef,
  type ViewState,
} from "../../../shared/ui/data-table";
import { optionLabel as roomOptionLabel, sortedRooms } from "../lib";
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
}: {
  roomsSlice: RoomsSlice;
  isEditor: boolean;
  onEdit: (room: RoomRow) => void;
  view: ViewState;
  onViewChange: (next: ViewState) => void;
}) {
  const sortedRows = useMemo(() => sortedRooms(roomsSlice.rooms), [roomsSlice.rooms]);
  const floorOptions = roomsSlice.single_select_options[ROOM_FLOOR_LEVEL_KEY];
  const zoneOptions = roomsSlice.single_select_options[ROOM_BUILDING_ZONE_KEY];
  const fieldDefs = useMemo<FieldDef[]>(
    () => [
      { field_key: "number", field_type: "text", display_name: "Number", required: true },
      { field_key: "name", field_type: "text", display_name: "Name", required: true },
      { field_key: ROOM_FLOOR_LEVEL_KEY, field_type: "single_select", display_name: "Floor" },
      { field_key: ROOM_BUILDING_ZONE_KEY, field_type: "single_select", display_name: "Zone" },
      { field_key: "num_people", field_type: "number", display_name: "People" },
      { field_key: "num_bedrooms", field_type: "number", display_name: "Bedrooms" },
      { field_key: "icfa_factor", field_type: "number", display_name: "iCFA" },
    ],
    [],
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
        accessor: (room) => tableOptionLabel(floorOptions, room.floor_level),
        render: (room) => tableOptionLabel(floorOptions, room.floor_level),
      },
      {
        id: "building_zone",
        fieldKey: ROOM_BUILDING_ZONE_KEY,
        header: "Zone",
        accessor: (room) => tableOptionLabel(zoneOptions, room.building_zone),
        render: (room) => tableOptionLabel(zoneOptions, room.building_zone),
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
    ],
    [floorOptions, zoneOptions],
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
      onRowOpen={isEditor ? onEdit : undefined}
    />
  );
}

function tableOptionLabel(
  options: Parameters<typeof roomOptionLabel>[0],
  optionId: string | null,
): string {
  return roomOptionLabel(options, optionId) || "Unassigned";
}
