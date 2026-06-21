import { flexRender, type Header, type Table } from "@tanstack/react-table";
import {
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { numberUnitForSystem, numberUnitLabel, type UnitSystem } from "../../../../lib/units";
import type { GridColumnDragKeyboard } from "../hooks/useGridColumnDragKeyboard";
import type { GridColumnResize } from "../hooks/useGridColumnResize";
import { isAttributeLocked, isBuiltInField, isFieldDuplicable } from "../lib/locks";
import type { AxisRoleSubset, DataTableColumnDef, FieldDef } from "../types";
import { AddFieldTailCell } from "./AddFieldTailCell";
import { ColumnResizeHandle } from "./ColumnResizeHandle";
import { CustomFieldDescriptionTooltip } from "./CustomFieldDescriptionTooltip";
import { FieldTypeIcon } from "./FieldTypeIcon";
import { HeaderContextMenu } from "./HeaderContextMenu";
import { SortableHeaderCell } from "./SortableHeaderCell";

// Header onMouseDown owns column-select; double-click on editable
// custom headers opens the field config modal.
// Header `<th>` refs are captured into `headerCellRefByFieldKey` so
// dialogs and header menus can return focus to the originating column.
// Field config is reached via the right-click `<HeaderContextMenu>`,
// double-click, or Enter — there is no per-column `⋯` trigger.
//
// Plan 08: every non-primary header `<th>` is wrapped in
// `<SortableHeaderCell>`. The `DndContext` + `SortableContext` live
// at the `DataTable` level (outside `<table>` — dnd-kit injects
// accessibility `<div>`s next to its children, which would be
// invalid nested inside `<thead>`).
//
// Per-cell state (the `triggerRef` for `HeaderContextMenu`) lives in
// the `<DataTableHeaderCell>` subcomponent so each cell can hold its
// own ref without bending React's rules-of-hooks inside a loop.
export type HeaderActionHandlers = {
  onSortAsc: (fieldKey: string) => void;
  onSortDesc: (fieldKey: string) => void;
  onFilterBy: (fieldKey: string) => void;
  onGroupBy: (fieldKey: string) => void;
  onHide: (fieldKey: string) => void;
  onDeleteCustomField?: (fieldKey: string) => void;
  onDuplicateCustomField?: (fieldKey: string) => void;
  // Opens the unified field-config modal for a custom field. The anchor
  // element is stashed so the modal can return focus on close.
  onEditCustomFieldConfig?: (fieldKey: string, anchorElement: HTMLElement | null) => void;
  // The anchor is the clicked `<th>` (captured by the menu's triggerRef)
  // so the DataTable can return focus to it after create mode closes.
  onInsertFieldLeft?: (fieldKey: string, anchorElement: HTMLElement | null) => void;
  onInsertFieldRight?: (fieldKey: string, anchorElement: HTMLElement | null) => void;
};

export type GridHeaderProps<TRow> = {
  table: Table<TRow>;
  visibleColumnDefs: DataTableColumnDef<TRow>[];
  fieldDefByKey: Map<string, FieldDef>;
  axisRolesByFieldKey: Map<string, AxisRoleSubset>;
  onColumnMouseDown?: (event: ReactMouseEvent<HTMLElement>, fieldKey: string) => void;
  readOnly: boolean;
  hasWriteHandler: boolean;
  headerCellRefByFieldKey?: Map<string, HTMLTableCellElement>;
  // Plan 08 §4.3 — Space/Arrow/Esc on a focused non-primary header
  // routes here. When omitted, header keyboard reorder is disabled.
  columnDragKeyboard?: GridColumnDragKeyboard;
  // When omitted, no resize handle is rendered on any column.
  columnResize?: GridColumnResize;
  headerActions: HeaderActionHandlers;
  // When set, the tail `+` cell becomes a focusable button that opens
  // the create-field modal; otherwise it renders as a disabled preview.
  onAddFieldFromTail?: () => void;
  tailCellRef?: { current: HTMLTableCellElement | null };
  // Active unit preference; drives the per-field unit-label chip in
  // number-with-units headers. Defaults to "SI".
  unitSystem?: UnitSystem;
};

export function GridHeader<TRow>({
  table,
  visibleColumnDefs,
  fieldDefByKey,
  axisRolesByFieldKey,
  onColumnMouseDown,
  readOnly,
  hasWriteHandler,
  headerCellRefByFieldKey,
  columnDragKeyboard,
  columnResize,
  headerActions,
  onAddFieldFromTail,
  tailCellRef,
  unitSystem = "SI",
}: GridHeaderProps<TRow>) {
  const pickedUpColumnIndex = columnDragKeyboard?.pickedUpColumnIndex ?? null;
  return (
    <thead>
      {table.getHeaderGroups().map((headerGroup) => (
        <tr key={headerGroup.id} role="row" aria-rowindex={1}>
          <th className="data-table-gutter" aria-label="Row number" />
          {headerGroup.headers.map((header, columnIndex) => {
            const column = visibleColumnDefs[columnIndex];
            if (!column) return null;
            const schemaFieldKey = column.schemaFieldKey ?? column.fieldKey;
            const fieldDef =
              fieldDefByKey.get(schemaFieldKey) ?? fieldDefByKey.get(column.fieldKey);
            const isPrimary = columnIndex === 0;
            return (
              <DataTableHeaderCell
                key={header.id}
                header={header}
                column={column}
                schemaFieldKey={schemaFieldKey}
                columnIndex={columnIndex}
                fieldDef={fieldDef}
                axisTint={axisRolesByFieldKey.get(column.fieldKey)}
                isPrimary={isPrimary}
                readOnly={readOnly}
                hasWriteHandler={hasWriteHandler}
                headerCellRefByFieldKey={headerCellRefByFieldKey}
                columnDragKeyboard={columnDragKeyboard}
                pickedUp={pickedUpColumnIndex === columnIndex}
                columnResize={columnResize}
                onColumnMouseDown={onColumnMouseDown}
                headerActions={headerActions}
                unitSystem={unitSystem}
              />
            );
          })}
          <AddFieldTailCell variant="th" onClick={onAddFieldFromTail} ref={tailCellRef} />
        </tr>
      ))}
    </thead>
  );
}

type DataTableHeaderCellProps<TRow> = {
  header: Header<TRow, unknown>;
  column: DataTableColumnDef<TRow>;
  schemaFieldKey: string;
  columnIndex: number;
  fieldDef: FieldDef | undefined;
  axisTint: AxisRoleSubset | undefined;
  isPrimary: boolean;
  readOnly: boolean;
  hasWriteHandler: boolean;
  headerCellRefByFieldKey?: Map<string, HTMLTableCellElement>;
  columnDragKeyboard?: GridColumnDragKeyboard;
  pickedUp: boolean;
  columnResize?: GridColumnResize;
  onColumnMouseDown?: (event: ReactMouseEvent<HTMLElement>, fieldKey: string) => void;
  headerActions: HeaderActionHandlers;
  unitSystem: UnitSystem;
};

function DataTableHeaderCell<TRow>({
  header,
  column,
  schemaFieldKey,
  columnIndex,
  fieldDef,
  axisTint,
  isPrimary,
  readOnly,
  hasWriteHandler,
  headerCellRefByFieldKey,
  columnDragKeyboard,
  pickedUp,
  columnResize,
  onColumnMouseDown,
  headerActions,
  unitSystem,
}: DataTableHeaderCellProps<TRow>) {
  const triggerRef = useRef<HTMLTableCellElement | null>(null);
  // Header lock glyph: today equivalent to "is built-in" (built-ins
  // always carry at least delete + duplicate locks), but the signal is
  // "has at least one author-declared lock" so it stays correct if a
  // future custom-field author exposes locks.
  const schemaLocked = isBuiltInField(fieldDef);
  const className = ["data-table-th", isPrimary ? "data-table-frozen" : ""]
    .filter(Boolean)
    .join(" ");
  const columnDragKeyDown =
    columnDragKeyboard && !isPrimary
      ? buildHeaderKeyDown(columnIndex, columnDragKeyboard)
      : undefined;
  const description = fieldDef?.description?.trim() ?? "";
  const onDeleteCustomField =
    fieldDef && headerActions.onDeleteCustomField && !isAttributeLocked(fieldDef, "delete")
      ? () => headerActions.onDeleteCustomField?.(column.fieldKey)
      : undefined;
  const onDuplicateCustomField =
    fieldDef &&
    isFieldDuplicable(fieldDef) &&
    fieldTypeSupportsDuplicate(fieldDef) &&
    headerActions.onDuplicateCustomField
      ? () => headerActions.onDuplicateCustomField?.(column.fieldKey)
      : undefined;
  const onInsertFieldLeft = headerActions.onInsertFieldLeft
    ? () => headerActions.onInsertFieldLeft?.(column.fieldKey, triggerRef.current)
    : undefined;
  const onInsertFieldRight = headerActions.onInsertFieldRight
    ? () => headerActions.onInsertFieldRight?.(column.fieldKey, triggerRef.current)
    : undefined;
  const canEditFieldConfig = Boolean(
    fieldDef &&
    !fieldDef.read_only &&
    !readOnly &&
    hasWriteHandler &&
    headerActions.onEditCustomFieldConfig,
  );
  const onEditCustomFieldConfig =
    canEditFieldConfig && headerActions.onEditCustomFieldConfig
      ? () => headerActions.onEditCustomFieldConfig?.(schemaFieldKey, triggerRef.current)
      : undefined;
  const doubleClickAction = canEditFieldConfig ? onEditCustomFieldConfig : undefined;
  const headerKeyDown =
    canEditFieldConfig || columnDragKeyDown
      ? (event: ReactKeyboardEvent<HTMLTableCellElement>) => {
          if (
            event.key === "Enter" &&
            canEditFieldConfig &&
            (columnDragKeyboard?.pickedUpColumnIndex ?? null) === null
          ) {
            event.preventDefault();
            event.stopPropagation();
            onEditCustomFieldConfig?.();
            return;
          }
          columnDragKeyDown?.(event);
        }
      : undefined;
  return (
    <SortableHeaderCell
      id={column.id}
      isPrimary={isPrimary}
      ariaColIndex={columnIndex + 1}
      className={className}
      axisTint={axisTint}
      fieldEditable={canEditFieldConfig}
      fieldEditorOpen={false}
      isPickedUp={pickedUp}
      schemaLocked={schemaLocked}
      cellRef={(node) => {
        triggerRef.current = node;
        if (!headerCellRefByFieldKey) return;
        if (node) headerCellRefByFieldKey.set(column.fieldKey, node);
        else headerCellRefByFieldKey.delete(column.fieldKey);
      }}
      onKeyDown={headerKeyDown}
      onMouseDown={
        onColumnMouseDown ? (event) => onColumnMouseDown(event, column.fieldKey) : undefined
      }
      onDoubleClick={
        doubleClickAction
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              doubleClickAction();
            }
          : undefined
      }
    >
      <div className="data-table-header-row">
        {fieldDef ? <FieldTypeIcon fieldDef={fieldDef} /> : null}
        <span className="data-table-header-label">
          {flexRender(header.column.columnDef.header, header.getContext())}
        </span>
        {fieldDef?.field_type === "number" && fieldDef.numberUnits ? (
          <span className="data-table-header-units" data-testid="data-table-header-units">
            {numberUnitLabel(numberUnitForSystem(fieldDef.numberUnits, unitSystem))}
          </span>
        ) : null}
        {description && fieldDef ? (
          <CustomFieldDescriptionTooltip
            description={description}
            fieldDisplayName={fieldDef.display_name}
          />
        ) : null}
      </div>
      {fieldDef ? (
        <HeaderContextMenu
          fieldDef={fieldDef}
          triggerRef={triggerRef}
          isViewer={readOnly}
          onSortAsc={() => headerActions.onSortAsc(column.fieldKey)}
          onSortDesc={() => headerActions.onSortDesc(column.fieldKey)}
          onFilterBy={() => headerActions.onFilterBy(column.fieldKey)}
          onGroupBy={() => headerActions.onGroupBy(column.fieldKey)}
          // The pinned record_id slot is never hideable.
          onHide={isPrimary ? undefined : () => headerActions.onHide(column.fieldKey)}
          onDeleteField={onDeleteCustomField}
          onDuplicateField={onDuplicateCustomField}
          onEditFieldConfig={onEditCustomFieldConfig}
          onInsertFieldLeft={onInsertFieldLeft}
          onInsertFieldRight={onInsertFieldRight}
        />
      ) : null}
      {columnResize && column.resizable !== false ? (
        <ColumnResizeHandle
          columnId={column.id}
          active={columnResize.activeColumnId === column.id}
          onPointerDown={(event) => columnResize.onHandlePointerDown(column.id, event)}
          onDoubleClick={() => columnResize.onHandleDoubleClick(column.id)}
        />
      ) : null}
    </SortableHeaderCell>
  );
}

// Per-type duplicability — single_select / attachment excluded because
// cloning their value (option list / attachment slot) isn't defined
// yet. Independent of the `"duplicate"` lock key, which is the
// author's policy switch.
function fieldTypeSupportsDuplicate(fieldDef: FieldDef | undefined): boolean {
  return (
    fieldDef?.field_type === "text" ||
    fieldDef?.field_type === "number" ||
    fieldDef?.field_type === "computed" ||
    fieldDef?.field_type === "color"
  );
}

// Routes Space / ←→ / Esc on a focused non-primary header to the
// keyboard-drag state machine. `preventDefault` keeps the keystroke
// from bubbling into the wrapper's grid-navigation handler (which
// would otherwise interpret Space as type-to-edit on the active cell
// and arrows as cell-selection moves). Once any column is picked up
// every header's Space / ←→ / Esc map to commit / move / cancel —
// the keyboard focus stays on the cell the user originally pressed
// Space on, while the pickup target visually slides; routing the
// keystroke through the originally-focused cell is what lets the
// gesture complete without a focus jump.
function buildHeaderKeyDown(
  columnIndex: number,
  handlers: GridColumnDragKeyboard,
): (event: ReactKeyboardEvent<HTMLTableCellElement>) => void {
  return (event) => {
    const pickupActive = handlers.pickedUpColumnIndex !== null;
    if (event.key === "Escape" && pickupActive) {
      event.preventDefault();
      handlers.onCancel();
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      if (pickupActive) handlers.onCommit();
      else handlers.onPickup(columnIndex);
      return;
    }
    if (pickupActive && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      handlers.onMove(event.key === "ArrowLeft" ? -1 : 1);
      return;
    }
  };
}
