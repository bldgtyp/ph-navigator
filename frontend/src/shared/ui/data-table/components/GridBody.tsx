import { flexRender, type Table } from "@tanstack/react-table";
import type { ReactNode } from "react";
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
                {renderCellContent({
                  edit,
                  rowId: row.id,
                  fieldKey,
                  fallback: () => flexRender(cell.column.columnDef.cell, cell.getContext()),
                  onCommitAndMove: (shiftKey) =>
                    void edit.commit().then((committed) => {
                      if (committed) onCommitAndMove(rowIndex, columnIndex, shiftKey);
                    }),
                })}
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  );
}

// Pick the cell's inner content. When the cell is in edit mode, choose
// the editor matching the typed draft. Single-select rendering is the
// noop fall-through here until Step 3 wires SingleSelectPopover.
function renderCellContent(args: {
  edit: GridEdit;
  rowId: string;
  fieldKey: string;
  fallback: () => ReactNode;
  onCommitAndMove: (shiftKey: boolean) => void;
}): ReactNode {
  const { edit, rowId, fieldKey, fallback, onCommitAndMove } = args;
  if (!edit.isEditingCell(rowId, fieldKey) || !edit.editing) return fallback();
  const editor = edit.editing.editor;
  if (editor.kind === "text" || editor.kind === "number") {
    return (
      <InlineCellEditor
        value={editor.draftValue}
        onChange={edit.draft}
        onCancel={edit.cancel}
        onCommit={() => void edit.commit()}
        onCommitAndMove={onCommitAndMove}
      />
    );
  }
  // single_select: popover renders in Step 3. For now, show the static
  // cell content so the table doesn't render a blank `<td>` while
  // edit state is open — matters only if a future caller opens a
  // single_select edit before Step 3 lands.
  return fallback();
}
