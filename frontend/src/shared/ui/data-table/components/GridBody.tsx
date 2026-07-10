// @size-exception: planning/features/row-context-menu/PRD.md
import { flexRender, type Table } from "@tanstack/react-table";
import type { Virtualizer } from "@tanstack/react-virtual";
import { AlertTriangle } from "lucide-react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { describeDuplicateRows } from "../lib/identifier/recordId";
import type { DuplicateIdentifierRows } from "../lib/identifier/recordId";
import { computeEdgeBits } from "../lib/range/edgeBits";
import { isCellInNormalizedRange, type NormalizedRange } from "../lib/range/normalize";
import { isPointerInActiveEditor } from "../lib/eventTargets";
import { isEmptyNumericValue, isNumericFieldDef } from "../lib/numberDisplay";
import { canEditFieldOptions } from "../lib/options/mutability";
import type {
  AxisRoleSubset,
  BodyPlanItem,
  CellCommitMove,
  CellCoord,
  DataTableColumnDef,
  FieldDef,
  FieldOption,
  FillRect,
  LinkedRecordColumnCell,
  LinkedRecordCellOps,
} from "../types";
import { LinkedRecordCell } from "../fields/linkedRecord/LinkedRecordCell";
import { LinkedRecordPicker } from "../fields/linkedRecord/Picker";
import { LookupCell } from "../fields/lookup/LookupCell";

// Stable empty-options reference. Using `[]` inline forces a fresh array
// identity each render, which would cascade through SingleSelectPopover's
// memoized cycleTargets and re-fire its highlight effect every commit
// (— "Maximum update depth exceeded" after a text→single_select change
// when fieldDef.options is briefly missing).
const EMPTY_OPTIONS: FieldOption[] = [];
// Stable empties for the linked_record render path — same identity-
// cascade reasoning as `EMPTY_OPTIONS`.
const EMPTY_LINKED_CANDIDATES: LinkedRecordCellOps["candidates"] = [];
const EMPTY_LINKED_IDS: readonly string[] = [];
const emptyResolver: LinkedRecordCellOps["resolve"] = () => null;

function cellKey(rowId: string, fieldKey: string): string {
  return `${rowId}\u0000${fieldKey}`;
}

function toLinkedIdList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return EMPTY_LINKED_IDS;
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string" && entry.length > 0) out.push(entry);
  }
  return out;
}
import type { GridEdit } from "../hooks/useGridEdit";
import type { GridRowSelection, RowSelectionMode } from "../hooks/useGridRowSelection";
import { AddFieldTailCell } from "./AddFieldTailCell";
import { ColorCell, ColorCellEditor } from "./ColorCell";
import { FillHandle } from "./FillHandle";
import { GridChevron } from "./GridChevron";
import { GridGutter } from "./GridGutter";
import { GroupHeaderRow } from "./GroupHeaderRow";
import { InlineCellEditor } from "./InlineCellEditor";
import { SingleSelectCell } from "./SingleSelectCell";
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
  // Row-hover Expand button in the gutter. REQUIRED — DataTable always
  // supplies a handler (the consumer's `onRowOpen`, else the built-in
  // record-detail modal), so the gutter never renders a dead affordance.
  onRowExpand: (row: TRow) => void;
  onCommitAndMove: (rowIndex: number, columnIndex: number, move: CellCommitMove) => void;
  // Phase 7: fill state from `useGridFill`. The bottom-right cell of
  // `fillSource` carries `data-fill-handle="true"` and renders
  // `<FillHandle>` when `fillHandleVisible` is true. Cells inside
  // `fillTargetPreview` carry `data-fill-target="true"` so CSS tints
  // them during a drag.
  fillSource?: FillRect | null;
  fillTargetPreview?: FillRect | null;
  fillHandleVisible?: boolean;
  onFillHandleMouseDown?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  copiedRange?: NormalizedRange | null;
  pasteFlashCells?: ReadonlySet<string>;
  // Plan 05: gate the single-select chevron affordance. When false
  // (read-only / viewer mode / no write handler), the chevron is
  // hidden on active single-select cells. Inline-edit start paths
  // (onCellOpen) already gate themselves on the same flag — this is
  // just the render-side mirror so the affordance matches the gesture.
  cellsWritable?: boolean;
  // The pinned record_id column shows a non-blocking warning chip when
  // another visible row has the same non-empty identifier value.
  identifierColumnId?: string | null;
  identifierDuplicates?: ReadonlyMap<string, DuplicateIdentifierRows>;
  // Phase 3 (catalog-perf): row virtualizer keyed on `bodyPlan.length`,
  // plus a precomputed map from a data-row index (the selection's
  // `activeCell.rowIndex` and TanStack `tableRows[i]` cursor) to its
  // bodyPlan index. The body renders only the rows the virtualizer
  // returns, surrounded by spacer `<tr>`s that consume the unrendered
  // heights so the scrollbar geometry matches a full table.
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  bodyPlanIndexByDataRowIndex: readonly number[];
  // Phase 1 row-context-menu — right-click on a data row opens the
  // shared menu owned by DataTable. Undefined in viewer / readOnly /
  // no-onWrite surfaces so the browser's native menu surfaces instead.
  // `editingActive` lets the predicate suppress the menu while an
  // editor (text / color / single-select) or fill-handle is open.
  onRowContextMenu?: (args: {
    rowId: string;
    rowNumber: number;
    x: number;
    y: number;
    returnFocus: HTMLElement | null;
  }) => void;
  onGroupHeaderContextMenu?: (args: { x: number; y: number }) => void;
  editingActive?: boolean;
  // Per-fieldKey linked_record integration (PRD §5 Phase 1). When a
  // cell's resolved FieldDef is `linked_record`, the body renders
  // `LinkedRecordCell` in read mode and `LinkedRecordPicker` in edit
  // mode using the ops bag keyed by the cell's fieldKey. Absent
  // entries fall through to an empty pill list (read) / empty picker
  // (edit) — the cell still renders.
  linkedRecordOps?: ReadonlyMap<string, LinkedRecordCellOps>;
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
  copiedRange = null,
  pasteFlashCells,
  cellsWritable = false,
  identifierColumnId = null,
  identifierDuplicates,
  rowVirtualizer,
  bodyPlanIndexByDataRowIndex,
  onRowContextMenu,
  onGroupHeaderContextMenu,
  editingActive = false,
  linkedRecordOps,
}: GridBodyProps<TRow>) {
  const tableRows = table.getRowModel().rows;
  const isSourceEmpty = totalRowCount === 0;
  // Precompute the identifier column index so the per-cell duplicate
  // chip check is a single integer compare.
  const identifierColumnIndex =
    identifierColumnId === null
      ? -1
      : visibleColumnDefs.findIndex((column) => column.id === identifierColumnId);
  // Reverse lookup: bodyPlan index → data-row index. Built once per
  // render from the (already-computed) data-row → bodyPlan mapping so
  // the per-virtual-row resolver is a cheap array read.
  const dataRowIndexByBodyPlanIndex = (() => {
    const result: number[] = new Array(bodyPlan.length).fill(-1);
    for (let dataIdx = 0; dataIdx < bodyPlanIndexByDataRowIndex.length; dataIdx += 1) {
      const planIdx = bodyPlanIndexByDataRowIndex[dataIdx];
      if (planIdx !== undefined) result[planIdx] = dataIdx;
    }
    return result;
  })();
  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]!.start : 0;
  const paddingBottom =
    virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1]!.end : 0;
  // Column count for spacer `colSpan`: gutter (1) + visible columns + tail (1).
  const totalColSpan = visibleColumnDefs.length + 2;
  const hasMultiCellRange =
    hasExplicitRange &&
    (normalizedActiveRange.rowStart !== normalizedActiveRange.rowEnd ||
      normalizedActiveRange.columnStart !== normalizedActiveRange.columnEnd);
  const handleTbodyContextMenu =
    onRowContextMenu || onGroupHeaderContextMenu
      ? (event: ReactMouseEvent<HTMLTableSectionElement>) => {
          const target = event.target as HTMLElement;
          if (isPointerInActiveEditor(target, { editingActive })) return;
          if (target.closest("input.data-table-gutter-checkbox")) return;
          const groupRow = target.closest<HTMLTableRowElement>("tr.data-table-group-row");
          if (groupRow && onGroupHeaderContextMenu) {
            event.preventDefault();
            onGroupHeaderContextMenu({
              x: event.clientX,
              y: event.clientY,
            });
            return;
          }
          if (!onRowContextMenu) return;
          const tr = target.closest<HTMLTableRowElement>("tr[data-row-id]");
          if (!tr) return;
          const rowIdAttr = tr.dataset.rowId;
          if (!rowIdAttr) return;
          const dataIndex = Number(tr.dataset.index);
          const item = bodyPlan[dataIndex];
          if (!item || item.kind !== "data") return;
          const rowNumber = (dataRowIndexByBodyPlanIndex[dataIndex] ?? -1) + 1;
          if (rowNumber <= 0) return;
          event.preventDefault();
          onRowContextMenu({
            rowId: rowIdAttr,
            rowNumber,
            x: event.clientX,
            y: event.clientY,
            returnFocus: null,
          });
        }
      : undefined;

  return (
    <tbody onContextMenu={handleTbodyContextMenu}>
      {bodyPlan.length === 0 ? (
        <tr role="row" aria-rowindex={2}>
          <td className="data-table-filter-empty" colSpan={totalColSpan}>
            {isSourceEmpty ? emptyMessage : "No rows match the current table view."}
          </td>
        </tr>
      ) : null}
      {paddingTop > 0 ? (
        <tr aria-hidden="true" style={{ height: paddingTop }}>
          <td colSpan={totalColSpan} style={{ padding: 0, border: 0 }} />
        </tr>
      ) : null}
      {virtualItems.map((virtualItem) => {
        const item = bodyPlan[virtualItem.index];
        if (!item) return null;
        const ariaRowIndex = virtualItem.index + 2; // +1 for header row, +1 for 1-based
        const measureRef = (el: Element | null) => {
          if (el) rowVirtualizer.measureElement(el);
        };
        if (item.kind === "group") {
          return (
            <GroupHeaderRow
              key={virtualItem.key}
              measureRef={measureRef}
              dataIndex={virtualItem.index}
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
        const rowIndex = dataRowIndexByBodyPlanIndex[virtualItem.index] ?? -1;
        const tanstackRow = rowIndex >= 0 ? tableRows[rowIndex] : undefined;
        if (!tanstackRow || rowIndex < 0) return null;
        const isLastDataRow = rowIndex === rowIds.length - 1;
        // Hoisted per-row duplicate lookup; only depends on rowId, so
        // it doesn't belong inside the per-cell loop.
        const rowIdForRow = rowIds[rowIndex];
        const duplicateIdentifier =
          identifierColumnIndex >= 0 && rowIdForRow !== undefined
            ? identifierDuplicates?.get(rowIdForRow)
            : undefined;
        const duplicateTooltip =
          duplicateIdentifier && duplicateIdentifier.totalOthers > 0
            ? describeDuplicateRows(duplicateIdentifier)
            : "";
        return (
          <tr
            key={virtualItem.key}
            ref={measureRef}
            data-index={virtualItem.index}
            data-row-id={rowIdForRow}
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
              onExpandRow={() => onRowExpand(tanstackRow.original)}
              onContextMenuKey={
                onRowContextMenu && rowIdForRow !== undefined
                  ? ({ x, y, trigger }) =>
                      onRowContextMenu({
                        rowId: rowIdForRow,
                        rowNumber: rowIndex + 1,
                        x,
                        y,
                        returnFocus: trigger,
                      })
                  : undefined
              }
            />
            {tanstackRow.getVisibleCells().map((cell, columnIndex) => {
              const selected =
                hasMultiCellRange &&
                isCellInNormalizedRange({ rowIndex, columnIndex }, normalizedActiveRange);
              const selectionEdgeTop = selected && rowIndex === normalizedActiveRange.rowStart;
              const selectionEdgeRight =
                selected && columnIndex === normalizedActiveRange.columnEnd;
              const selectionEdgeBottom = selected && rowIndex === normalizedActiveRange.rowEnd;
              const selectionEdgeLeft =
                selected && columnIndex === normalizedActiveRange.columnStart;
              const active =
                activeCell.rowIndex === rowIndex && activeCell.columnIndex === columnIndex;
              const fieldKey = fieldKeys[columnIndex] ?? "";
              const rowId = rowIds[rowIndex];
              const editing =
                rowId !== undefined && fieldKey ? edit.isEditingCell(rowId, fieldKey) : false;
              const cellError =
                rowId !== undefined && fieldKey ? edit.cellError(rowId, fieldKey) : null;
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
              const copiedEdgeBits =
                copiedRange && isCellInNormalizedRange({ rowIndex, columnIndex }, copiedRange)
                  ? computeEdgeBits(rowIndex, columnIndex, copiedRange)
                  : null;
              // Plan 05: render the chevron on every writable single-
              // select cell so CSS can fade it in on hover OR the active
              // cell. Skipped while an editor is open — the popover
              // replaces the static pill render and a chevron sitting
              // next to it would be redundant.
              const fieldDef = fieldKey ? fieldDefByKey.get(fieldKey) : undefined;
              const showSelectChevron =
                !editing && cellsWritable && fieldDef?.field_type === "single_select";
              // Plan 30 D13 — chip surfaces only on the identifier
              // column cell of a row whose identifier value collides
              // with another row. The duplicate lookup and tooltip
              // formatting are hoisted to the per-row scope above.
              const showDuplicateChip =
                columnIndex === identifierColumnIndex && duplicateTooltip !== "";
              const isNumericCell = isNumericFieldDef(fieldDef);
              return (
                <td
                  key={cell.id}
                  role="gridcell"
                  aria-colindex={columnIndex + 1}
                  aria-selected={selected}
                  aria-invalid={cellError ? "true" : undefined}
                  data-row-id={rowId}
                  data-field-key={fieldKey || undefined}
                  data-cell-error={cellError ? "true" : undefined}
                  data-numeric-cell={isNumericCell ? "true" : undefined}
                  data-axis-tint={axisTint}
                  data-fill-handle={isFillSourceCorner ? "true" : undefined}
                  data-fill-target={isFillTarget ? "true" : undefined}
                  data-copied-cell={copiedEdgeBits ? "true" : undefined}
                  data-just-pasted={
                    rowId !== undefined &&
                    fieldKey &&
                    pasteFlashCells?.has(cellKey(rowId, fieldKey))
                      ? "true"
                      : undefined
                  }
                  data-row-edge={isLastDataRow ? "bottom" : undefined}
                  className={[
                    visibleColumnDefs[columnIndex]?.className,
                    isNumericCell ? "data-table-numeric-cell" : "",
                    columnIndex === 0 ? "data-table-frozen" : "",
                    selected ? "data-table-cell-selected" : "",
                    selectionEdgeTop ? "data-table-selection-edge-top" : "",
                    selectionEdgeRight ? "data-table-selection-edge-right" : "",
                    selectionEdgeBottom ? "data-table-selection-edge-bottom" : "",
                    selectionEdgeLeft ? "data-table-selection-edge-left" : "",
                    copiedEdgeBits ? "data-table-cell-copied" : "",
                    copiedEdgeBits?.top ? "data-table-copied-edge-top" : "",
                    copiedEdgeBits?.right ? "data-table-copied-edge-right" : "",
                    copiedEdgeBits?.bottom ? "data-table-copied-edge-bottom" : "",
                    copiedEdgeBits?.left ? "data-table-copied-edge-left" : "",
                    active ? "data-table-cell-active" : "",
                    editing ? "data-table-cell-editing" : "",
                    cellError ? "data-table-cell-error" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  title={cellError ?? undefined}
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
                    if (active && cellsWritable && fieldDef?.field_type === "single_select") {
                      onCellOpen(tanstackRow.original, columnIndex);
                      return;
                    }
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
                      : () => {
                          const activateEdit = visibleColumnDefs[columnIndex]?.onActivateEdit;
                          if (fieldDef?.field_type === "linked_record" && activateEdit) {
                            activateEdit(tanstackRow.original);
                            return;
                          }
                          onCellOpen(tanstackRow.original, columnIndex);
                        }
                  }
                >
                  {renderCellContent({
                    edit,
                    row: tanstackRow.original,
                    rowId: tanstackRow.id,
                    fieldKey,
                    fieldDef: fieldDefByKey.get(fieldKey),
                    cellValue: cell.getValue(),
                    fallback: () =>
                      visibleColumnDefs[columnIndex]?.render?.(tanstackRow.original, {
                        isActive: active,
                      }) ?? flexRender(cell.column.columnDef.cell, cell.getContext()),
                    onCommitAndMove: (move) =>
                      void edit.commit().then((committed) => {
                        if (committed) onCommitAndMove(rowIndex, columnIndex, move);
                      }),
                    linkedRecordOps: fieldKey ? linkedRecordOps?.get(fieldKey) : undefined,
                    linkedRecordCell: visibleColumnDefs[columnIndex]?.linkedRecordCell,
                    onActivateEdit: () => onCellOpen(tanstackRow.original, columnIndex),
                    isActive: active,
                  })}
                  {showDuplicateChip ? (
                    <span
                      className="data-table-identifier-duplicate"
                      data-testid="data-table-identifier-duplicate"
                      title={duplicateTooltip}
                      role="img"
                      aria-label={duplicateTooltip || "Duplicate identifier"}
                    >
                      <AlertTriangle aria-hidden size={12} />
                    </span>
                  ) : null}
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
            <AddFieldTailCell variant="td" />
          </tr>
        );
      })}
      {paddingBottom > 0 ? (
        <tr aria-hidden="true" style={{ height: paddingBottom }}>
          <td colSpan={totalColSpan} style={{ padding: 0, border: 0 }} />
        </tr>
      ) : null}
    </tbody>
  );
}

// Pick the cell's inner content. When the cell is in edit mode, choose
// the editor matching the typed draft (text/number → InlineCellEditor;
// single_select → SingleSelectPopover). Other field types fall through
// to the static render.
function renderCellContent<TRow>(args: {
  edit: GridEdit;
  row: TRow;
  rowId: string;
  fieldKey: string;
  fieldDef: FieldDef | undefined;
  cellValue: unknown;
  fallback: () => ReactNode;
  onCommitAndMove: (move: CellCommitMove) => void;
  linkedRecordOps: LinkedRecordCellOps | undefined;
  linkedRecordCell: LinkedRecordColumnCell<TRow> | undefined;
  // Opens the editor for this cell (same path as double-click).
  // Wired through LinkedRecordCell so the always-visible "+" button can
  // open the picker on a single click.
  onActivateEdit?: () => void;
  // True when this cell is the active cell (Airtable-parity: linked-
  // record pills only open / show "x" unlink when their cell is active).
  isActive?: boolean;
}): ReactNode {
  const {
    edit,
    row,
    rowId,
    fieldKey,
    fieldDef,
    cellValue,
    fallback,
    onCommitAndMove,
    linkedRecordOps,
    linkedRecordCell,
    onActivateEdit,
    isActive = false,
  } = args;
  if (!edit.isEditingCell(rowId, fieldKey) || !edit.editing) {
    if (fieldDef?.field_type === "color") return <ColorCell value={cellValue} />;
    if (fieldDef?.field_type === "number" && isEmptyNumericValue(cellValue)) {
      return (
        <span className="data-table-cell-content data-table-numeric-empty" aria-label="Empty">
          {fieldDef.numberUnits ? "" : "—"}
        </span>
      );
    }
    if (fieldDef?.field_type === "single_select") {
      return <SingleSelectCell value={cellValue} fieldDef={fieldDef} />;
    }
    if (fieldDef?.field_type === "lookup") return <LookupCell value={cellValue} />;
    if (fieldDef?.field_type === "linked_record" && linkedRecordCell) {
      const ids = linkedRecordCell.getIds(row);
      return (
        <LinkedRecordCell
          ids={ids}
          resolve={(targetRowId) => linkedRecordCell.resolve(targetRowId, row)}
          onPillClick={
            linkedRecordCell.onPillClick
              ? (targetRowId) => linkedRecordCell.onPillClick?.(targetRowId, row)
              : undefined
          }
          onPillUnlink={
            linkedRecordCell.onPillUnlink
              ? (targetRowId) => linkedRecordCell.onPillUnlink?.(targetRowId, row)
              : undefined
          }
          onActivateEdit={
            linkedRecordCell.onActivateEdit
              ? () => linkedRecordCell.onActivateEdit?.(row)
              : undefined
          }
          emptyLabel={linkedRecordCell.emptyLabel}
          isActive={isActive}
        />
      );
    }
    if (fieldDef?.field_type === "linked_record" && fieldDef.read_only) {
      return <span className="data-table-cell-content">{fallback()}</span>;
    }
    if (fieldDef?.field_type === "linked_record") {
      const ids = toLinkedIdList(cellValue);
      return (
        <LinkedRecordCell
          ids={ids}
          resolve={linkedRecordOps?.resolve ?? emptyResolver}
          onPillClick={linkedRecordOps?.onPillClick}
          onPillUnlink={(targetRowId) =>
            void edit.unlinkLinkedRecord({
              rowId,
              fieldKey,
              targetRowId,
              currentIds: ids,
            })
          }
          onActivateEdit={onActivateEdit}
          isActive={isActive}
        />
      );
    }
    return <span className="data-table-cell-content">{fallback()}</span>;
  }
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
  if (editor.kind === "color") {
    return (
      <ColorCellEditor
        value={editor.draftValue}
        onChange={edit.draft}
        onCancel={edit.cancel}
        onCommit={() => void edit.commit()}
        onCommitAndMove={onCommitAndMove}
        anchorChildren={
          <span className="data-table-color-editor-anchor">
            <ColorCell value={cellValue} />
          </span>
        }
      />
    );
  }
  if (editor.kind === "linked_record") {
    const maxLinks = fieldDef?.linked_record_config?.max_links ?? null;
    const mode = maxLinks === 1 ? "single" : "multi";
    return (
      <LinkedRecordPicker
        open
        mode={mode}
        selectedIds={toLinkedIdList(cellValue)}
        candidates={linkedRecordOps?.candidates ?? EMPTY_LINKED_CANDIDATES}
        isLoading={linkedRecordOps?.isLoading ?? false}
        onCancel={edit.cancel}
        onConfirm={(ids) => void edit.commitLinkedRecord(ids)}
        title={fieldDef?.display_name ? `Link ${fieldDef.display_name}` : "Link record"}
      />
    );
  }
  if (editor.kind === "single_select") {
    return (
      <SingleSelectPopover
        options={fieldDef?.options ?? EMPTY_OPTIONS}
        allowCreate={canEditFieldOptions(fieldDef)}
        searchText={editor.searchText}
        highlightedOptionId={editor.highlightedOptionId}
        onSearchTextChange={edit.draft}
        onHighlight={edit.highlight}
        onCancel={edit.cancel}
        onCommit={() => void edit.commit()}
        onCommitAndMove={(shiftKey) => onCommitAndMove({ kind: "tab", shiftKey })}
        anchorChildren={
          <span className="single-select-popover-anchor">
            <SingleSelectCell value={cellValue} fieldDef={fieldDef} />
          </span>
        }
      />
    );
  }
  return <span className="data-table-cell-content">{fallback()}</span>;
}
