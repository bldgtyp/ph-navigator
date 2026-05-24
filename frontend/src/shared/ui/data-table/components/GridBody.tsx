import { flexRender, type Table } from "@tanstack/react-table";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { isCellInNormalizedRange, type NormalizedRange } from "../lib";
import type {
  AxisRoleSubset,
  BodyPlanItem,
  CellCoord,
  DataTableColumnDef,
  FieldDef,
  FillRect,
} from "../types";
import type { GridEdit } from "../hooks/useGridEdit";
import type { GridRowSelection, RowSelectionMode } from "../hooks/useGridRowSelection";
import { FillHandle } from "./FillHandle";
import { GridChevron } from "./GridChevron";
import { GridGutter } from "./GridGutter";
import { GroupHeaderRow } from "./GroupHeaderRow";
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
  // Phase 6 §4.3: per-column subset code over {filter, sort, group}.
  // Absent entries == untinted. Cells emit `data-axis-tint="<code>"`
  // so the CSS attribute selector paints — no JS color work here.
  // Codes: "f" | "s" | "g" | "fs" | "fg" | "sg" | "fsg".
  axisRolesByFieldKey: Map<string, AxisRoleSubset>;
  // Phase 6 §4.6: interleaved group-header + data-row plan. When
  // ungrouped this is a flat sequence of data items and the body
  // renders exactly as Phase 5. With group rules active, group-header
  // items emit <GroupHeaderRow>s between data rows.
  bodyPlan: BodyPlanItem<TRow>[];
  onGroupToggle: (pathKey: string) => void;
  onCellActivate: (rowId: string, fieldKey: string) => void;
  onCellMouseDown?: (event: ReactMouseEvent<HTMLTableCellElement>) => void;
  onCellOpen: (row: TRow, columnIndex: number) => void;
  onRowSelect: (rowId: string) => void;
  onRowToggleSelected: (rowId: string, mode: RowSelectionMode) => void;
  // Plan 04 follow-up: row-hover Expand button in the gutter. Wired
  // when the consumer provides `onRowOpen` on DataTable; the gutter
  // hides the affordance entirely when undefined.
  onRowExpand?: (row: TRow) => void;
  onCommitAndMove: (rowIndex: number, columnIndex: number, shiftKey: boolean) => void;
  // Phase 7: fill state from `useGridFill`. The bottom-right cell of
  // `fillSource` carries `data-fill-handle="true"` and renders
  // `<FillHandle>` when `fillHandleVisible` is true. Cells inside
  // `fillTargetPreview` carry `data-fill-target="true"` so CSS tints
  // them during a drag.
  fillSource?: FillRect | null;
  fillTargetPreview?: FillRect | null;
  fillHandleVisible?: boolean;
  onFillHandleMouseDown?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  // Plan 05: gate the single-select chevron affordance. When false
  // (read-only / viewer mode / no write handler), the chevron is
  // hidden on active single-select cells. Inline-edit start paths
  // (onCellOpen) already gate themselves on the same flag — this is
  // just the render-side mirror so the affordance matches the gesture.
  cellsWritable?: boolean;
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
  axisRolesByFieldKey,
  bodyPlan,
  onGroupToggle,
  onCellActivate,
  onCellMouseDown,
  onCellOpen,
  onRowSelect,
  onRowToggleSelected,
  onRowExpand,
  onCommitAndMove,
  fillSource,
  fillTargetPreview,
  fillHandleVisible,
  onFillHandleMouseDown,
  cellsWritable = false,
}: GridBodyProps<TRow>) {
  const tableRows = table.getRowModel().rows;
  const isSourceEmpty = totalRowCount === 0;
  let ariaRowIndex = 1; // header row is 1; data + group rows start at 2.
  // TanStack receives `visibleDataRows` as its data source, so
  // `tableRows[i]` aligns with the i-th data item in `bodyPlan`. Walk
  // a cursor instead of building a row-id lookup each render.
  let dataRowIndex = 0;
  const hasMultiCellRange =
    hasExplicitRange &&
    (normalizedActiveRange.rowStart !== normalizedActiveRange.rowEnd ||
      normalizedActiveRange.columnStart !== normalizedActiveRange.columnEnd);
  return (
    <tbody>
      {bodyPlan.length === 0 ? (
        <tr role="row" aria-rowindex={2}>
          <td className="data-table-filter-empty" colSpan={visibleColumnDefs.length + 1}>
            {isSourceEmpty ? emptyMessage : "No rows match the current table view."}
          </td>
        </tr>
      ) : null}
      {bodyPlan.map((item) => {
        ariaRowIndex += 1;
        if (item.kind === "group") {
          return (
            <GroupHeaderRow
              key={`group::${item.pathKey}`}
              depth={item.depth}
              pathKey={item.pathKey}
              fieldDef={item.fieldDef}
              groupValue={item.groupValue}
              count={item.count}
              aggregatedValues={item.aggregatedValues}
              expanded={item.expanded}
              visibleColumnDefs={visibleColumnDefs}
              onToggle={onGroupToggle}
            />
          );
        }
        const rowIndex = dataRowIndex;
        dataRowIndex += 1;
        const tanstackRow = tableRows[rowIndex];
        if (!tanstackRow) return null;
        return (
          <tr
            key={tanstackRow.id}
            role="row"
            aria-rowindex={ariaRowIndex}
            data-row-depth={item.depth}
          >
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
              onExpandRow={onRowExpand ? () => onRowExpand(tanstackRow.original) : undefined}
            />
            {tanstackRow.getVisibleCells().map((cell, columnIndex) => {
              const selected =
                hasMultiCellRange &&
                isCellInNormalizedRange({ rowIndex, columnIndex }, normalizedActiveRange);
              const active =
                activeCell.rowIndex === rowIndex && activeCell.columnIndex === columnIndex;
              const fieldKey = fieldKeys[columnIndex] ?? "";
              const rowId = rowIds[rowIndex];
              const editing =
                rowId !== undefined && fieldKey ? edit.isEditingCell(rowId, fieldKey) : false;
              const axisTint = fieldKey ? axisRolesByFieldKey.get(fieldKey) : undefined;
              const isFillSourceCorner =
                fillHandleVisible === true &&
                fillSource != null &&
                rowIndex === fillSource.rowEnd &&
                columnIndex === fillSource.columnEnd;
              const isFillTarget =
                fillTargetPreview != null &&
                isCellInNormalizedRange({ rowIndex, columnIndex }, fillTargetPreview) &&
                !(
                  fillSource != null &&
                  isCellInNormalizedRange({ rowIndex, columnIndex }, fillSource)
                );
              // Plan 05: render the chevron on every writable single-
              // select cell so CSS can fade it in on hover OR the active
              // cell. Skipped while an editor is open — the popover
              // replaces the static pill render and a chevron sitting
              // next to it would be redundant.
              const fieldDef = fieldKey ? fieldDefByKey.get(fieldKey) : undefined;
              const showSelectChevron =
                !editing && cellsWritable && fieldDef?.field_type === "single_select";
              return (
                <td
                  key={cell.id}
                  role="gridcell"
                  aria-colindex={columnIndex + 1}
                  aria-selected={selected}
                  data-row-id={rowId}
                  data-field-key={fieldKey || undefined}
                  data-axis-tint={axisTint}
                  data-fill-handle={isFillSourceCorner ? "true" : undefined}
                  data-fill-target={isFillTarget ? "true" : undefined}
                  className={[
                    visibleColumnDefs[columnIndex]?.className,
                    columnIndex === 0 ? "data-table-frozen" : "",
                    selected ? "data-table-cell-selected" : "",
                    active ? "data-table-cell-active" : "",
                    editing ? "data-table-cell-editing" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseDown={onCellMouseDown}
                  onClick={(event) => {
                    // Phase 3: Shift+Click extends the range via the
                    // mousedown handler's `selection.extendTo`. The
                    // click event would otherwise call `setActive` and
                    // collapse the range we just extended, so skip the
                    // collapse when the modifier is held.
                    if (event.shiftKey) return;
                    // Plan 05: a chevron click starts inline edit on
                    // mousedown, then bubbles a click here. Activating
                    // would call focusGrid() and steal focus from the
                    // popover's search input — Radix would then fire
                    // focus-outside and close the popover immediately.
                    if (editing) return;
                    if (rowId !== undefined && fieldKey) onCellActivate(rowId, fieldKey);
                  }}
                  onDoubleClick={
                    // Plan 05: single-select cells use the chevron as
                    // the open affordance, so double-click here would
                    // race with the chevron path and re-open the
                    // popover under it. Other field types keep
                    // double-click as the open gesture.
                    fieldDef?.field_type === "single_select"
                      ? undefined
                      : () => onCellOpen(tanstackRow.original, columnIndex)
                  }
                >
                  {renderCellContent({
                    edit,
                    rowId: tanstackRow.id,
                    fieldKey,
                    fieldDef: fieldDefByKey.get(fieldKey),
                    fallback: () => flexRender(cell.column.columnDef.cell, cell.getContext()),
                    onCommitAndMove: (shiftKey) =>
                      void edit.commit().then((committed) => {
                        if (committed) onCommitAndMove(rowIndex, columnIndex, shiftKey);
                      }),
                  })}
                  {showSelectChevron ? (
                    <GridChevron
                      onMouseDown={() => onCellOpen(tanstackRow.original, columnIndex)}
                    />
                  ) : null}
                  {isFillSourceCorner && onFillHandleMouseDown ? (
                    <FillHandle onMouseDown={onFillHandleMouseDown} />
                  ) : null}
                </td>
              );
            })}
          </tr>
        );
      })}
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
