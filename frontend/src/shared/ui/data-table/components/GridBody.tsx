import { flexRender, type Table } from "@tanstack/react-table";
import { isCellInNormalizedRange, type NormalizedRange } from "../lib";
import type { CellCoord, DataTableColumnDef } from "../types";
import type { GridEdit } from "../hooks/useGridEdit";
import { GridGutter } from "./GridGutter";
import { InlineCellEditor } from "./InlineCellEditor";

// Pure tbody renderer. Hit targets emit stable identity to the parent;
// active/selection visuals derive from the normalized range projection.
export type GridBodyProps<TRow> = {
  table: Table<TRow>;
  visibleColumnDefs: DataTableColumnDef<TRow>[];
  rowIds: string[];
  fieldKeys: string[];
  normalizedActiveRange: NormalizedRange;
  activeCell: CellCoord;
  edit: GridEdit;
  onCellActivate: (rowId: string, fieldKey: string) => void;
  onCellOpen: (row: TRow, columnIndex: number) => void;
  onRowSelect: (rowId: string) => void;
  onCommitAndMove: (rowIndex: number, columnIndex: number, shiftKey: boolean) => void;
};

export function GridBody<TRow>({
  table,
  visibleColumnDefs,
  rowIds,
  fieldKeys,
  normalizedActiveRange,
  activeCell,
  edit,
  onCellActivate,
  onCellOpen,
  onRowSelect,
  onCommitAndMove,
}: GridBodyProps<TRow>) {
  const tableRows = table.getRowModel().rows;
  return (
    <tbody>
      {tableRows.length === 0 ? (
        <tr role="row" aria-rowindex={2}>
          <td className="data-table-filter-empty" colSpan={visibleColumnDefs.length + 1}>
            No rows match the current table view.
          </td>
        </tr>
      ) : null}
      {tableRows.map((row, rowIndex) => (
        <tr key={row.id} role="row" aria-rowindex={rowIndex + 2}>
          <GridGutter
            rowNumber={rowIndex + 1}
            onSelectRow={() => {
              const rowId = rowIds[rowIndex];
              if (rowId !== undefined) onRowSelect(rowId);
            }}
          />
          {row.getVisibleCells().map((cell, columnIndex) => {
            const selected = isCellInNormalizedRange(
              { rowIndex, columnIndex },
              normalizedActiveRange,
            );
            const active =
              activeCell.rowIndex === rowIndex && activeCell.columnIndex === columnIndex;
            const fieldKey = fieldKeys[columnIndex] ?? "";
            return (
              <td
                key={cell.id}
                role="gridcell"
                aria-colindex={columnIndex + 1}
                aria-selected={selected}
                className={[
                  visibleColumnDefs[columnIndex]?.className,
                  columnIndex === 0 ? "data-table-frozen" : "",
                  selected ? "data-table-cell-selected" : "",
                  active ? "data-table-cell-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  const rowId = rowIds[rowIndex];
                  if (rowId !== undefined && fieldKey) onCellActivate(rowId, fieldKey);
                }}
                onDoubleClick={() => onCellOpen(row.original, columnIndex)}
              >
                {edit.isEditingCell(row.id, fieldKey) && edit.editing ? (
                  <InlineCellEditor
                    value={edit.editing.draftValue}
                    onChange={edit.draft}
                    onCancel={edit.cancel}
                    onCommit={() => void edit.commit()}
                    onCommitAndMove={(shiftKey) => {
                      void edit.commit().then((committed) => {
                        if (committed) onCommitAndMove(rowIndex, columnIndex, shiftKey);
                      });
                    }}
                  />
                ) : (
                  flexRender(cell.column.columnDef.cell, cell.getContext())
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  );
}
