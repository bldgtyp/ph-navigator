import { useMemo } from "react";
import {
  TablePrimitiveStub,
  type TablePrimitiveStubColumn,
} from "../../../shared/ui/TablePrimitiveStub";
import { sortedRooms } from "../lib";
import {
  ROOM_BUILDING_ZONE_KEY,
  ROOM_FLOOR_LEVEL_KEY,
  type RoomRow,
  type RoomsSlice,
  type SingleSelectOption,
} from "../types";

export function RoomsTable({
  roomsSlice,
  isEditor,
  onEdit,
}: {
  roomsSlice: RoomsSlice;
  isEditor: boolean;
  onEdit: (room: RoomRow) => void;
}) {
  const sortedRows = useMemo(() => sortedRooms(roomsSlice.rooms), [roomsSlice.rooms]);
  const floorLabels = useMemo(
    () => optionLabelMap(roomsSlice.single_select_options[ROOM_FLOOR_LEVEL_KEY]),
    [roomsSlice.single_select_options],
  );
  const zoneLabels = useMemo(
    () => optionLabelMap(roomsSlice.single_select_options[ROOM_BUILDING_ZONE_KEY]),
    [roomsSlice.single_select_options],
  );
  const columns = useMemo<TablePrimitiveStubColumn<RoomRow>[]>(
    () => [
      { key: "number", header: "Number", render: (room) => room.number },
      { key: "name", header: "Name", render: (room) => room.name },
      {
        key: "floor_level",
        header: "Floor",
        render: (room) => optionLabel(floorLabels, room.floor_level),
      },
      {
        key: "building_zone",
        header: "Zone",
        render: (room) => optionLabel(zoneLabels, room.building_zone),
      },
      { key: "num_people", header: "People", render: (room) => room.num_people },
      { key: "num_bedrooms", header: "Bedrooms", render: (room) => room.num_bedrooms },
      { key: "icfa_factor", header: "iCFA", render: (room) => room.icfa_factor.toFixed(2) },
    ],
    [floorLabels, zoneLabels],
  );

  return (
    <TablePrimitiveStub
      rows={sortedRows}
      columns={columns}
      getRowId={(room) => room.id}
      emptyMessage={isEditor ? "No rooms yet." : "No rooms are published in this version."}
      onRowClick={isEditor ? onEdit : undefined}
    />
  );
}

function optionLabelMap(options: SingleSelectOption[]): Map<string, string> {
  return new Map(options.map((option) => [option.id, option.label]));
}

function optionLabel(labels: Map<string, string>, optionId: string | null): string {
  if (!optionId) return "Unassigned";
  return labels.get(optionId) ?? "Missing option";
}
