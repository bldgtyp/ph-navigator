import { flexRender, type Table } from "@tanstack/react-table";
import type { ReactNode } from "react";
import type { DataTableColumnDef, FieldDef, SortRule } from "../types";

// Pure presentational. Owns thead markup, sort affordance click target,
// and the slot the consumer uses to inject column-level menus (Phase 5
// option management lives there).
export type GridHeaderProps<TRow> = {
  table: Table<TRow>;
  visibleColumnDefs: DataTableColumnDef<TRow>[];
  fieldDefByKey: Map<string, FieldDef>;
  sort: SortRule[];
  onToggleSort: (fieldKey: string) => void;
  renderHeaderActions?: (field: FieldDef) => ReactNode;
};

export function GridHeader<TRow>({
  table,
  visibleColumnDefs,
  fieldDefByKey,
  sort,
  onToggleSort,
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
                className={columnIndex === 0 ? "data-table-frozen" : undefined}
              >
                <button
                  type="button"
                  className="data-table-header-button"
                  tabIndex={-1}
                  onClick={() => {
                    if (column) onToggleSort(column.fieldKey);
                  }}
                >
                  <span className="data-table-header-label">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </span>
                  {direction ? (
                    <span className="data-table-sort-indicator" aria-hidden="true">
                      {direction === "asc" ? "▲" : "▼"}
                    </span>
                  ) : null}
                </button>
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
