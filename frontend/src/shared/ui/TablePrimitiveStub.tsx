import type { ReactNode } from "react";

export type TablePrimitiveStubColumn<TRow> = {
  key: string;
  header: string;
  render: (row: TRow) => ReactNode;
  className?: string;
};

export function TablePrimitiveStub<TRow>({
  rows,
  columns,
  getRowId,
  emptyMessage,
  onRowClick,
}: {
  rows: TRow[];
  columns: TablePrimitiveStubColumn<TRow>[];
  getRowId: (row: TRow) => string;
  emptyMessage: string;
  onRowClick?: (row: TRow) => void;
}) {
  if (rows.length === 0) {
    return <div className="data-table-empty">{emptyMessage}</div>;
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.className}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowId(row)}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={() => onRowClick?.(row)}
              onKeyDown={(event) => {
                if (!onRowClick) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onRowClick(row);
                }
              }}
            >
              {columns.map((column) => (
                <td key={column.key} className={column.className}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
