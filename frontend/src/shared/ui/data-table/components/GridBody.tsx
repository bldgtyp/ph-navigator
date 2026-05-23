import { flexRender, type Table } from "@tanstack/react-table";
import type { CSSProperties, ReactNode } from "react";
import { computeEdgeBits, isCellInNormalizedRange, type NormalizedRange } from "../lib";
import type { CellCoord, DataTableColumnDef, FieldDef } from "../types";
import type { GridEdit } from "../hooks/useGridEdit";
import type { GridRowSelection, RowSelectionMode } from "../hooks/useGridRowSelection";
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
  hasExplicitRange: boolean;
  activeCell: CellCoord;
  edit: GridEdit;
  rowSelection: GridRowSelection;
  showRowCheckbox: boolean;
  emptyMessage: string;
  totalRowCount: number;
  onCellActivate: (rowId: string, fieldKey: string) => void;
  onCellOpen: (row: TRow, columnIndex: number) => void;
  onRowSelect: (rowId: string) => void;
  onRowToggleSelected: (rowId: string, mode: RowSelectionMode) => void;
  onCommitAndMove: (rowIndex: number, columnIndex: number, shiftKey: boolean) => void;
};

export function GridBody<TRow>({
  table,
  visibleColumnDefs,
  fieldDefByKey,
  rowIds,
  fieldKeys,
  normalizedActiveRange,
  hasExplicitRange,
  activeCell,
  edit,
  rowSelection,
  showRowCheckbox,
  emptyMessage,
  totalRowCount,
  onCellActivate,
  onCellOpen,
  onRowSelect,
  onRowToggleSelected,
  onCommitAndMove,
}: GridBodyProps<TRow>) {
  const tableRows = table.getRowModel().rows;
  const isSourceEmpty = totalRowCount === 0;
  return (
    <tbody>
      {tableRows.length === 0 ? (
        <tr role="row" aria-rowindex={2}>
          <td className="data-table-filter-empty" colSpan={visibleColumnDefs.length + 1}>
            {isSourceEmpty ? emptyMessage : "No rows match the current table view."}
          </td>
        </tr>
      ) : null}
      {tableRows.map((row, rowIndex) => (
        <tr key={row.id} role="row" aria-rowindex={rowIndex + 2}>
          <GridGutter
            rowNumber={rowIndex + 1}
            selected={rowSelection.isSelected(rowIds[rowIndex] ?? "")}
            showCheckbox={showRowCheckbox}
            onSelectRow={() => {
              const rowId = rowIds[rowIndex];
              if (rowId !== undefined) onRowSelect(rowId);
            }}
            onToggleSelected={(mode) => {
              const rowId = rowIds[rowIndex];
              if (rowId !== undefined) onRowToggleSelected(rowId, mode);
            }}
          />
          {row.getVisibleCells().map((cell, columnIndex) => {
            const selected =
              hasExplicitRange &&
              isCellInNormalizedRange({ rowIndex, columnIndex }, normalizedActiveRange);
            const active =
              activeCell.rowIndex === rowIndex && activeCell.columnIndex === columnIndex;
            const fieldKey = fieldKeys[columnIndex] ?? "";
            const rowId = rowIds[rowIndex];
            const edgeStyle = selected
              ? buildEdgeShadowStyle(rowIndex, columnIndex, normalizedActiveRange)
              : undefined;
            return (
              <td
                key={cell.id}
                role="gridcell"
                aria-colindex={columnIndex + 1}
                aria-selected={selected}
                data-row-id={rowId}
                data-field-key={fieldKey || undefined}
                className={[
                  visibleColumnDefs[columnIndex]?.className,
                  columnIndex === 0 ? "data-table-frozen" : "",
                  selected ? "data-table-cell-selected" : "",
                  active ? "data-table-cell-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={edgeStyle}
                onClick={() => {
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

// Phase 3 §4.10: compose the cell's perimeter-outline `box-shadow`
// from the edge bits. Interior cells of an N×M range have no edge
// bits set and receive `undefined` so React drops the inline style
// entirely (the interior fill comes from the `.data-table-cell-
// selected` CSS rule). Edge cells layer one inset shadow per edge so
// a multi-cell range draws as one contiguous rectangle.
const EDGE_SHADOWS: Record<keyof ReturnType<typeof computeEdgeBits>, string> = {
  top: "inset 0 1px 0 0 var(--accent-edge)",
  right: "inset -1px 0 0 0 var(--accent-edge)",
  bottom: "inset 0 -1px 0 0 var(--accent-edge)",
  left: "inset 1px 0 0 0 var(--accent-edge)",
};

function buildEdgeShadowStyle(
  rowIndex: number,
  columnIndex: number,
  range: NormalizedRange,
): CSSProperties | undefined {
  const edges = computeEdgeBits(rowIndex, columnIndex, range);
  const parts: string[] = [];
  if (edges.top) parts.push(EDGE_SHADOWS.top);
  if (edges.right) parts.push(EDGE_SHADOWS.right);
  if (edges.bottom) parts.push(EDGE_SHADOWS.bottom);
  if (edges.left) parts.push(EDGE_SHADOWS.left);
  return parts.length ? { boxShadow: parts.join(", ") } : undefined;
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
