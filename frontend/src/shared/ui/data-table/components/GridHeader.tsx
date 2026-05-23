import { flexRender, type Table } from "@tanstack/react-table";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import type { DataTableColumnDef, FieldDef } from "../types";

// Pure presentational. Owns thead markup and the slot the consumer
// uses to inject column-level menus (Phase 5 option management lives
// there).
//
// Phase 3 R1: the whole `<th>` is the column-select hit target —
// mousedown anywhere outside a button toggles the column-select.
//
// Phase 4 §4.9: header-click sort is removed. The per-column sort
// chevron, the `data-table-header-button`, the `aria-sort` attribute,
// and the `onToggleSort` prop are all gone. Sort lives only in the
// toolbar Sort popover. The header label is now a plain `<span>`; it
// cannot be clicked or focused. The `data-axis-tint` attribute on each
// `<th>` drives per-column axis tinting (filter green / sort peach)
// per §4.10.
export type GridHeaderProps<TRow> = {
  table: Table<TRow>;
  visibleColumnDefs: DataTableColumnDef<TRow>[];
  fieldDefByKey: Map<string, FieldDef>;
  axisTintByFieldKey: Map<string, "filter" | "sort" | null>;
  onColumnMouseDown?: (event: ReactMouseEvent<HTMLElement>, fieldKey: string) => void;
  renderHeaderActions?: (field: FieldDef) => ReactNode;
};

export function GridHeader<TRow>({
  table,
  visibleColumnDefs,
  fieldDefByKey,
  axisTintByFieldKey,
  onColumnMouseDown,
  renderHeaderActions,
}: GridHeaderProps<TRow>) {
  return (
    <thead>
      {table.getHeaderGroups().map((headerGroup) => (
        <tr key={headerGroup.id} role="row" aria-rowindex={1}>
          <th className="data-table-gutter" aria-label="Row number" />
          {headerGroup.headers.map((header, columnIndex) => {
            const column = visibleColumnDefs[columnIndex];
            const axisTint = column ? (axisTintByFieldKey.get(column.fieldKey) ?? null) : null;
            return (
              <th
                key={header.id}
                role="columnheader"
                aria-colindex={columnIndex + 1}
                data-axis-tint={axisTint ?? undefined}
                className={[
                  "data-table-th",
                  columnIndex === 0 ? "data-table-frozen" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onMouseDown={
                  column && onColumnMouseDown
                    ? (event) => onColumnMouseDown(event, column.fieldKey)
                    : undefined
                }
              >
                <div className="data-table-header-row">
                  <span className="data-table-header-label">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </span>
                </div>
                {column
                  ? renderHeaderActions?.(
                      fieldDefByKey.get(column.fieldKey) ?? {
                        field_key: column.fieldKey,
                        field_type: "text",
                        display_name: column.header,
                      },
                    )
                  : null}
              </th>
            );
          })}
        </tr>
      ))}
    </thead>
  );
}
