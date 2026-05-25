import { useMemo, type CSSProperties } from "react";
import {
  DataTable,
  getCustomValue,
  type DataTableColumnDef,
  type DataTableProps,
  type FieldDef,
  type TableSchema,
  type ViewState,
} from "../../../shared/ui/data-table";
import { singleSelectOption } from "../../../shared/ui/data-table/lib";
import { sortedRooms } from "../lib";
import {
  ROOM_BUILDING_ZONE_COLUMN_ID,
  ROOM_BUILDING_ZONE_KEY,
  ROOM_FLOOR_LEVEL_COLUMN_ID,
  ROOM_FLOOR_LEVEL_KEY,
  type RoomRow,
  type RoomsSlice,
} from "../types";

export function RoomsTable({
  roomsSlice,
  tableSchema,
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
  onResetView,
}: {
  roomsSlice: RoomsSlice;
  // Plan-14 P1.4: produced by the parent's single `useTableSchema`
  // call so the schema fingerprint isn't recomputed alongside view
  // state in EquipmentTab.
  tableSchema: TableSchema;
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
  onResetView?: DataTableProps<RoomRow>["onResetView"];
}) {
  const sortedRows = useMemo(() => sortedRooms(roomsSlice.rooms), [roomsSlice.rooms]);
  const { fieldDefs, customFields } = tableSchema;
  const fieldDefByKey = useMemo(
    () => new Map(fieldDefs.map((fieldDef) => [fieldDef.field_key, fieldDef])),
    [fieldDefs],
  );
  const customColumns = useMemo<DataTableColumnDef<RoomRow>[]>(
    () =>
      customFields.map((custom) => {
        const fieldDef = fieldDefByKey.get(custom.id);
        return {
          id: custom.id,
          fieldKey: custom.id,
          header: custom.display_name,
          accessor: (room) =>
            fieldDef ? getCustomValue(room, fieldDef) ?? null : null,
        };
      }),
    [customFields, fieldDefByKey],
  );
  const columns = useMemo<DataTableColumnDef<RoomRow>[]>(
    () => [
      {
        id: "number",
        fieldKey: "number",
        header: "Number",
        accessor: (room) => room.number,
        defaultWidth: 120,
      },
      {
        id: "name",
        fieldKey: "name",
        header: "Name",
        accessor: (room) => room.name,
        defaultWidth: 240,
      },
      {
        id: ROOM_FLOOR_LEVEL_COLUMN_ID,
        fieldKey: ROOM_FLOOR_LEVEL_KEY,
        header: "Floor",
        accessor: (room) => room.floor_level,
        render: (room) => optionPill(room.floor_level, fieldDefByKey.get(ROOM_FLOOR_LEVEL_KEY)),
      },
      {
        id: ROOM_BUILDING_ZONE_COLUMN_ID,
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
        measureText: (room) => room.icfa_factor.toFixed(2),
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
        defaultWidth: 200,
      },
      ...customColumns,
    ],
    [fieldDefByKey, customColumns],
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
      onResetView={onResetView}
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
