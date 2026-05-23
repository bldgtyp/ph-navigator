import { flexRender, type Table } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { isCellInNormalizedRange, type NormalizedRange } from "../lib";
import type { CellCoord, DataTableColumnDef, FieldDef } from "../types";
import type { GridEdit } from "../hooks/useGridEdit";
import { GridGutter } from "./GridGutter";
import { InlineCellEditor } from "./InlineCellEditor";
import { SingleSelectPopover } from "./SingleSelectPopover";

// Pure tbody renderer. Hit targets emit stable identity to the parent;
// active/selection visuals derive from the normalized range projection.
export type GridBodyProps<TRow> = {
  table: Table<TRow>;
  visibleColumnDefs: DataTableColumnDef<TRow>[];
  fieldDefByKey: Map<string, FieldDef>;
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
  fieldDefByKey,
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
                  fieldDef: fieldDefByKey.get(fieldKey),
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
// the editor matching the typed draft (text/number → InlineCellEditor;
// single_select → SingleSelectPopover). Other field types fall through
// to the static render.
function renderCellContent(args: {
  edit: GridEdit;
  rowId: string;
  fieldKey: string;
  fieldDef: FieldDef | undefined;
  fallback: () => ReactNode;
  onCommitAndMove: (shiftKey: boolean) => void;
}): ReactNode {
  const { edit, rowId, fieldKey, fieldDef, fallback, onCommitAndMove } = args;
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
  if (editor.kind === "single_select") {
    return (
      <SingleSelectPopover
        options={fieldDef?.options ?? []}
        searchText={editor.searchText}
        highlightedOptionId={editor.highlightedOptionId}
        onSearchTextChange={edit.draft}
        onHighlight={edit.highlight}
        onCancel={edit.cancel}
        onCommit={() => void edit.commit()}
        onCommitAndMove={onCommitAndMove}
        anchorChildren={<span className="single-select-popover-anchor">{fallback()}</span>}
      />
    );
  }
  return fallback();
}
