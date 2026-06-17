import { useMemo, type CSSProperties } from "react";
import {
  DataTable,
  RECORD_ID_FIELD_KEY,
  getCustomLink,
  type DataTableColumnDef,
  type DataTableProps,
  type FieldDef,
  type LinkedRecordCellOps,
  type LinkedRecordTargetTableOption,
  type TableSchema,
  type ViewState,
} from "../../../shared/ui/data-table";

import { singleSelectOption } from "../../../shared/ui/data-table/lib";
import { customNumberValue, customTextValue } from "../lib/customValueReaders";
import {
  computedFieldColumnDef,
  customFieldColumnDefs,
} from "../../../shared/ui/data-table/feature";
import {
  ROOM_BUILDING_ZONE_COLUMN_ID,
  ROOM_BUILDING_ZONE_KEY,
  ROOM_FLOOR_LEVEL_COLUMN_ID,
  ROOM_FLOOR_LEVEL_KEY,
  ROOM_SPACE_TYPE_FIELD_KEY,
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
  onDeleteCustomField,
  onAddCustomField,
  onDuplicateCustomField,
  onEditCustomFieldBundle,
  formulaFieldRegistry,
  getFormulaRowValues,
  rowsComputed,
  linkedRecordOps,
  linkedRecordTargets,
}: {
  roomsSlice: RoomsSlice;
  // Plan-14 P1.4: produced by the parent's single `useTableSchema`
  // call so the schema fingerprint isn't recomputed alongside view
  // state in RoomsPage.
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
  onDeleteCustomField?: DataTableProps<RoomRow>["onDeleteCustomField"];
  onAddCustomField?: DataTableProps<RoomRow>["onAddCustomField"];
  onDuplicateCustomField?: DataTableProps<RoomRow>["onDuplicateCustomField"];
  onEditCustomFieldBundle?: DataTableProps<RoomRow>["onEditCustomFieldBundle"];
  formulaFieldRegistry?: DataTableProps<RoomRow>["formulaFieldRegistry"];
  getFormulaRowValues?: DataTableProps<RoomRow>["getFormulaRowValues"];
  rowsComputed?: Record<string, Record<string, unknown>>;
  linkedRecordOps?: ReadonlyMap<string, LinkedRecordCellOps>;
  linkedRecordTargets?: ReadonlyArray<LinkedRecordTargetTableOption>;
}) {
  const { fieldDefs, customFields } = tableSchema;
  const fieldDefByKey = useMemo(
    () => new Map(fieldDefs.map((fieldDef) => [fieldDef.field_key, fieldDef])),
    [fieldDefs],
  );
  const customColumns = useMemo<DataTableColumnDef<RoomRow>[]>(
    () =>
      customFieldColumnDefs({
        customFields,
        fieldDefByKey,
        rowsComputed,
      }),
    [customFields, fieldDefByKey, rowsComputed],
  );
  const columns = useMemo<DataTableColumnDef<RoomRow>[]>(() => {
    const recordIdFieldDef = fieldDefByKey.get(RECORD_ID_FIELD_KEY);
    const spaceTypeColumn: DataTableColumnDef<RoomRow>[] = fieldDefByKey.has(
      ROOM_SPACE_TYPE_FIELD_KEY,
    )
      ? [
          {
            id: ROOM_SPACE_TYPE_FIELD_KEY,
            fieldKey: ROOM_SPACE_TYPE_FIELD_KEY,
            header: fieldDefByKey.get(ROOM_SPACE_TYPE_FIELD_KEY)?.display_name ?? "Space Type",
            accessor: (room) => getCustomLink(room, ROOM_SPACE_TYPE_FIELD_KEY),
            measureText: (room) => getCustomLink(room, ROOM_SPACE_TYPE_FIELD_KEY).join(","),
            defaultWidth: 180,
          },
        ]
      : [];
    return [
      // Rooms is the formula exception: the Display Name identifier is
      // the `{Number} — {Name}` formula kept on the `record_id` field,
      // not a separate descriptive `name`. Number and Name stay below as
      // the ordinary inputs the formula reads.
      computedFieldColumnDef<RoomRow>({
        fieldKey: RECORD_ID_FIELD_KEY,
        header: recordIdFieldDef?.display_name ?? "Display Name",
        computedType: recordIdFieldDef?.computed_type ?? "text",
        rowsComputed,
        defaultWidth: 180,
        isIdentifier: true,
      }),
      {
        id: "number",
        fieldKey: "number",
        header: fieldDefByKey.get("number")?.display_name ?? "Number",
        accessor: (room) => customTextValue(room, "number"),
        defaultWidth: 120,
      },
      {
        id: "name",
        fieldKey: "name",
        header: fieldDefByKey.get("name")?.display_name ?? "Name",
        accessor: (room) => customTextValue(room, "name"),
        defaultWidth: 240,
      },
      {
        id: ROOM_FLOOR_LEVEL_COLUMN_ID,
        fieldKey: ROOM_FLOOR_LEVEL_KEY,
        header: fieldDefByKey.get(ROOM_FLOOR_LEVEL_KEY)?.display_name ?? "Floor",
        accessor: (room) => room.floor_level,
        render: (room) => optionPill(room.floor_level, fieldDefByKey.get(ROOM_FLOOR_LEVEL_KEY)),
      },
      {
        id: ROOM_BUILDING_ZONE_COLUMN_ID,
        fieldKey: ROOM_BUILDING_ZONE_KEY,
        header: fieldDefByKey.get(ROOM_BUILDING_ZONE_KEY)?.display_name ?? "Zone",
        accessor: (room) => room.building_zone,
        render: (room) => optionPill(room.building_zone, fieldDefByKey.get(ROOM_BUILDING_ZONE_KEY)),
      },
      ...spaceTypeColumn,
      {
        id: "num_people",
        fieldKey: "num_people",
        header: fieldDefByKey.get("num_people")?.display_name ?? "People",
        accessor: (room) => customNumberValue(room, "num_people"),
        className: "numeric-cell",
      },
      {
        id: "num_bedrooms",
        fieldKey: "num_bedrooms",
        header: fieldDefByKey.get("num_bedrooms")?.display_name ?? "Bedrooms",
        accessor: (room) => customNumberValue(room, "num_bedrooms"),
        className: "numeric-cell",
      },
      {
        id: "icfa_factor",
        fieldKey: "icfa_factor",
        header: fieldDefByKey.get("icfa_factor")?.display_name ?? "iCFA",
        accessor: (room) => room.icfa_factor,
        render: (room) => room.icfa_factor.toFixed(2),
        measureText: (room) => room.icfa_factor.toFixed(2),
        className: "numeric-cell",
      },
      ...customColumns,
    ];
  }, [fieldDefByKey, customColumns, rowsComputed]);

  return (
    <DataTable
      rows={roomsSlice.rooms}
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
      onDeleteCustomField={onDeleteCustomField}
      onAddCustomField={onAddCustomField}
      onDuplicateCustomField={onDuplicateCustomField}
      onEditCustomFieldBundle={onEditCustomFieldBundle}
      formulaFieldRegistry={formulaFieldRegistry}
      getFormulaRowValues={getFormulaRowValues}
      linkedRecordOps={linkedRecordOps}
      linkedRecordTargets={linkedRecordTargets}
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
