import { flexRender, type Table } from "@tanstack/react-table";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { AxisRoleSubset, DataTableColumnDef, FieldDef } from "../types";

// Header onMouseDown owns column-select; double-click on editable
// single_select headers opens the field editor via `onEditField`.
// Header `<th>` refs are captured into `headerCellRefByFieldKey` so
// the popover can anchor to them.
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
            const axisTint = column ? axisRolesByFieldKey.get(column.fieldKey) : undefined;
            const fieldDef = column ? fieldDefByKey.get(column.fieldKey) : undefined;
            const isEditableSingleSelect =
              !!column &&
              fieldDef?.field_type === "single_select" &&
              !readOnly &&
              hasWriteHandler &&
              !!onEditField;
            const isEditorOpen =
              !!column && openFieldKey != null && openFieldKey === column.fieldKey;
            return (
              <th
                key={header.id}
                ref={(node) => {
                  if (!column || !headerCellRefByFieldKey) return;
                  if (node) headerCellRefByFieldKey.set(column.fieldKey, node);
                  else headerCellRefByFieldKey.delete(column.fieldKey);
                }}
                role="columnheader"
                aria-colindex={columnIndex + 1}
                data-axis-tint={axisTint}
                data-field-editable={isEditableSingleSelect ? "true" : undefined}
                data-field-editor-open={isEditorOpen ? "true" : undefined}
                className={["data-table-th", columnIndex === 0 ? "data-table-frozen" : ""]
                  .filter(Boolean)
                  .join(" ")}
                onMouseDown={
                  column && onColumnMouseDown
                    ? (event) => onColumnMouseDown(event, column.fieldKey)
                    : undefined
                }
                onDoubleClick={
                  isEditableSingleSelect && column
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
                </div>
              </th>
            );
          })}
        </tr>
      ))}
    </thead>
  );
}
