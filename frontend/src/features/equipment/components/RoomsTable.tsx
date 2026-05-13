import { useMemo, type CSSProperties } from "react";
import {
  DataTable,
  type DataTableColumnDef,
  type FieldDef,
  type ViewState,
  type WriteOp,
} from "../../../shared/ui/data-table";
import { singleSelectOption } from "../../../shared/ui/data-table/lib";
import { sortedRooms } from "../lib";
import { RoomOptionManager } from "./RoomOptionManager";
import {
  ROOM_BUILDING_ZONE_KEY,
  ROOM_FLOOR_LEVEL_KEY,
  type RoomOptionKey,
  type RoomRow,
  type RoomsSlice,
  type SingleSelectOption,
} from "../types";

export function RoomsTable({
  roomsSlice,
  isEditor,
  onEdit,
  view,
  onViewChange,
  onWrite,
  onSaveOptions,
}: {
  roomsSlice: RoomsSlice;
  isEditor: boolean;
  onEdit: (room: RoomRow) => void;
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  onWrite: (op: WriteOp) => void;
  onSaveOptions: (
    fieldKey: RoomOptionKey,
    options: SingleSelectOption[],
    replacements?: Record<string, string | null>,
  ) => void;
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
      renderHeaderActions={(fieldDef) => {
        if (
          fieldDef.field_key !== ROOM_FLOOR_LEVEL_KEY &&
          fieldDef.field_key !== ROOM_BUILDING_ZONE_KEY
        ) {
          return null;
        }
        return (
          <RoomOptionManager
            fieldKey={fieldDef.field_key}
            label={fieldDef.display_name}
            options={fieldDef.options ?? []}
            required={fieldDef.required}
            rooms={roomsSlice.rooms}
            disabled={!isEditor}
            onSave={onSaveOptions}
          />
        );
      }}
      onRowOpen={isEditor ? onEdit : undefined}
    />
  );
}

function optionPill(value: string | null, fieldDef: FieldDef | undefined) {
  const option = singleSelectOption(value, fieldDef);
  const label = value ? (option?.label ?? "Missing option") : "Unassigned";
  return (
    <span
      className={
        option ? "single-select-pill" : value ? "single-select-pill missing" : "muted-cell"
      }
      style={option ? ({ "--option-color": option.color } as CSSProperties) : undefined}
    >
      {label}
    </span>
  );
}
