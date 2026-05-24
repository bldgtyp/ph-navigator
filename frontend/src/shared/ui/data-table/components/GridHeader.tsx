import { flexRender, type Table } from "@tanstack/react-table";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { AxisRoleSubset, DataTableColumnDef, FieldDef } from "../types";
import { ColumnHeaderMenu } from "./ColumnHeaderMenu";
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
}: GridHeaderProps<TRow>) {
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
                cellRef={(node) => {
                  if (!headerCellRefByFieldKey) return;
                  if (node) headerCellRefByFieldKey.set(column.fieldKey, node);
                  else headerCellRefByFieldKey.delete(column.fieldKey);
                }}
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
              </SortableHeaderCell>
            );
          })}
        </tr>
      ))}
    </thead>
  );
}
