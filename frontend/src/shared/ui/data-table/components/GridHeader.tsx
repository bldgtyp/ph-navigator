import { flexRender, type Table } from "@tanstack/react-table";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import type { GridColumnDragKeyboard } from "../hooks/useGridColumnDragKeyboard";
import type { GridColumnResize } from "../hooks/useGridColumnResize";
import type { AxisRoleSubset, DataTableColumnDef, FieldDef } from "../types";
import { AddFieldTailCell } from "./AddFieldTailCell";
import { ColumnHeaderMenu } from "./ColumnHeaderMenu";
import { ColumnResizeHandle } from "./ColumnResizeHandle";
import { SortableHeaderCell } from "./SortableHeaderCell";

// Header onMouseDown owns column-select; double-click on editable
// single_select headers opens the field editor via `onEditField`.
// Header `<th>` refs are captured into `headerCellRefByFieldKey` so
// the popover can anchor to them. `<ColumnHeaderMenu>` owns the
// show/hide decision for the `⋯` trigger internally.
//
// Plan 08: every non-primary header `<th>` is wrapped in
// `<SortableHeaderCell>`. The `DndContext` + `SortableContext` live
// at the `DataTable` level (outside `<table>` — dnd-kit injects
// accessibility `<div>`s next to its children, which would be
// invalid nested inside `<thead>`). `SortableHeaderCell` reads the
// sortable state via dnd-kit's context provider regardless of where
// the provider sits in the tree.
export type GridHeaderProps<TRow> = {
  table: Table<TRow>;
  visibleColumnDefs: DataTableColumnDef<TRow>[];
  fieldDefByKey: Map<string, FieldDef>;
  axisRolesByFieldKey: Map<string, AxisRoleSubset>;
  onColumnMouseDown?: (event: ReactMouseEvent<HTMLElement>, fieldKey: string) => void;
  readOnly: boolean;
  hasWriteHandler: boolean;
  onEditField?: (fieldKey: string) => void;
  openFieldKey?: string | null;
  headerCellRefByFieldKey?: Map<string, HTMLTableCellElement>;
  // Plan 08 §4.3 — Space/Arrow/Esc on a focused non-primary header
  // routes here. When omitted, header keyboard reorder is disabled.
  columnDragKeyboard?: GridColumnDragKeyboard;
  // When omitted, no resize handle is rendered on any column.
  columnResize?: GridColumnResize;
};

export function GridHeader<TRow>({
  table,
  visibleColumnDefs,
  fieldDefByKey,
  axisRolesByFieldKey,
  onColumnMouseDown,
  readOnly,
  hasWriteHandler,
  onEditField,
  openFieldKey,
  headerCellRefByFieldKey,
  columnDragKeyboard,
  columnResize,
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
            const axisTint = axisRolesByFieldKey.get(column.fieldKey);
            const fieldDef = fieldDefByKey.get(column.fieldKey);
            const isEditableSingleSelect =
              fieldDef?.field_type === "single_select" &&
              !readOnly &&
              hasWriteHandler &&
              !!onEditField;
            const isEditorOpen = openFieldKey != null && openFieldKey === column.fieldKey;
            const isPrimary = columnIndex === 0;
            const className = ["data-table-th", isPrimary ? "data-table-frozen" : ""]
              .filter(Boolean)
              .join(" ");
            const isPickedUp = pickedUpColumnIndex === columnIndex;
            const headerKeyDown =
              columnDragKeyboard && !isPrimary
                ? buildHeaderKeyDown(columnIndex, columnDragKeyboard)
                : undefined;
            return (
              <SortableHeaderCell
                key={header.id}
                id={column.id}
                isPrimary={isPrimary}
                ariaColIndex={columnIndex + 1}
                className={className}
                axisTint={axisTint}
                fieldEditable={isEditableSingleSelect}
                fieldEditorOpen={isEditorOpen}
                isPickedUp={isPickedUp}
                cellRef={(node) => {
                  if (!headerCellRefByFieldKey) return;
                  if (node) headerCellRefByFieldKey.set(column.fieldKey, node);
                  else headerCellRefByFieldKey.delete(column.fieldKey);
                }}
                onKeyDown={headerKeyDown}
                onMouseDown={
                  onColumnMouseDown
                    ? (event) => onColumnMouseDown(event, column.fieldKey)
                    : undefined
                }
                onDoubleClick={
                  isEditableSingleSelect
                    ? (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onEditField?.(column.fieldKey);
                      }
                    : undefined
                }
              >
                <div className="data-table-header-row">
                  <span className="data-table-header-label">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </span>
                  {isEditableSingleSelect ? (
                    <span aria-hidden className="data-table-header-edit-chevron">
                      ▾
                    </span>
                  ) : null}
                  {fieldDef ? (
                    <ColumnHeaderMenu
                      fieldDef={fieldDef}
                      canEditOptions={isEditableSingleSelect}
                      onEditOptions={() => onEditField?.(column.fieldKey)}
                    />
                  ) : null}
                </div>
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
          })}
          <AddFieldTailCell variant="th" />
        </tr>
      ))}
    </thead>
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
