import { flexRender, type Table } from "@tanstack/react-table";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import type { DataTableColumnDef, FieldDef, SortRule } from "../types";

// Pure presentational. Owns thead markup and the slot the consumer
// uses to inject column-level menus (Phase 5 option management lives
// there). Phase 3 R1: the whole `<th>` is the column-select hit target
// — mousedown anywhere outside a button toggles the column-select. The
// existing sort gesture moves to a small chevron button (visible on
// hover or when sort is active); the chevron's mousedown is filtered
// out by `useGridPointerDrag.onColumnMouseDown`'s "skip if mousedown
// landed in a button" check, so clicking the chevron toggles sort and
// nothing else.
export type GridHeaderProps<TRow> = {
  table: Table<TRow>;
  visibleColumnDefs: DataTableColumnDef<TRow>[];
  fieldDefByKey: Map<string, FieldDef>;
  sort: SortRule[];
  onToggleSort: (fieldKey: string) => void;
  onColumnMouseDown?: (event: ReactMouseEvent<HTMLElement>, fieldKey: string) => void;
  renderHeaderActions?: (field: FieldDef) => ReactNode;
};

export function GridHeader<TRow>({
  table,
  visibleColumnDefs,
  fieldDefByKey,
  sort,
  onToggleSort,
  onColumnMouseDown,
  renderHeaderActions,
}: GridHeaderProps<TRow>) {
  const directionByFieldKey = new Map(sort.map((rule) => [rule.fieldKey, rule.direction]));
  return (
    <thead>
      {table.getHeaderGroups().map((headerGroup) => (
        <tr key={headerGroup.id} role="row" aria-rowindex={1}>
          <th className="data-table-gutter" aria-label="Row number" />
          {headerGroup.headers.map((header, columnIndex) => {
            const column = visibleColumnDefs[columnIndex];
            const direction = column ? directionByFieldKey.get(column.fieldKey) : undefined;
            const sortIndicator = direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕";
            const sortAriaLabel = column
              ? `Sort by ${column.header}${direction === "asc" ? " (currently ascending)" : direction === "desc" ? " (currently descending)" : ""}`
              : "Sort";
            return (
              <th
                key={header.id}
                role="columnheader"
                aria-colindex={columnIndex + 1}
                aria-sort={
                  direction === "asc"
                    ? "ascending"
                    : direction === "desc"
                      ? "descending"
                      : undefined
                }
                className={[
                  "data-table-th",
                  direction ? "is-sorted" : "",
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
                  {column ? (
                    <button
                      type="button"
                      className="data-table-sort-button"
                      tabIndex={-1}
                      aria-label={sortAriaLabel}
                      onClick={() => onToggleSort(column.fieldKey)}
                    >
                      <span className="data-table-sort-indicator" aria-hidden="true">
                        {sortIndicator}
                      </span>
                    </button>
                  ) : null}
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
