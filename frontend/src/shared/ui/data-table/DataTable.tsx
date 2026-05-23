import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import {
  applyFilters,
  buildEmptyRowDefaults,
  extractRowDefaults,
  formatDisplayCellValue,
  sortRows,
} from "./lib";
import { generatedId } from "../../lib/ids";
import { useGridHistory } from "./hooks/useGridHistory";
import { useGridWriteReducer } from "./hooks/useGridWriteReducer";
import { useGridSelection } from "./hooks/useGridSelection";
import { useGridRowSelection } from "./hooks/useGridRowSelection";
import { useGridEdit } from "./hooks/useGridEdit";
import { getFieldEditor } from "./fields/registry";
import { useGridKeyboard } from "./hooks/useGridKeyboard";
import { useGridPointerDrag } from "./hooks/useGridPointerDrag";
import { useGridClipboard } from "./hooks/useGridClipboard";
import { GridHeader } from "./components/GridHeader";
import { GridBody } from "./components/GridBody";
import { GridToolbar } from "./components/GridToolbar";
import { ConfirmRowDeleteDialog } from "./components/ConfirmRowDeleteDialog";
import type { CellCoord, DataTableProps, FieldDef, RowDeletePayload, WriteOp } from "./types";

export function DataTable<TRow>({
  rows,
  getRowId,
  fieldDefs,
  columnDefs,
  view,
  onViewChange,
  onWrite,
  buildEmptyRow,
  generateRowId,
  sessionKey,
  renderHeaderActions,
  readOnly = false,
  density = "compact",
  emptyMessage,
  onRowOpen,
}: DataTableProps<TRow>) {
  const visibleColumnDefs = useMemo(() => {
    const hidden = new Set(view.hiddenColumns);
    const byId = new Map(columnDefs.map((column) => [column.id, column]));
    const ordered = view.columnOrder
      .map((id) => byId.get(id))
      .filter((column): column is (typeof columnDefs)[number] => Boolean(column));
    const remainder = columnDefs.filter((column) => !view.columnOrder.includes(column.id));
    return [...ordered, ...remainder].filter((column) => !hidden.has(column.id));
  }, [columnDefs, view.columnOrder, view.hiddenColumns]);
  const fieldDefByKey = useMemo(
    () => new Map(fieldDefs.map((fieldDef) => [fieldDef.field_key, fieldDef])),
    [fieldDefs],
  );
  const filteredRows = useMemo(
    () =>
      sortRows(
        applyFilters(rows, visibleColumnDefs, fieldDefs, view.filter),
        visibleColumnDefs,
        fieldDefs,
        view.sort,
      ),
    [rows, visibleColumnDefs, fieldDefs, view.filter, view.sort],
  );
  const rowIds = useMemo(() => filteredRows.map(getRowId), [filteredRows, getRowId]);
  const fieldKeys = useMemo(
    () => visibleColumnDefs.map((column) => column.fieldKey),
    [visibleColumnDefs],
  );

  const [announce, setAnnounce] = useState("");
  const history = useGridHistory();
  const { dispatchWrite, undoOnce, redoOnce } = useGridWriteReducer({ history, onWrite });
  const selection = useGridSelection({ rowIds, fieldKeys });
  const rowSelection = useGridRowSelection({ rowIds });
  const edit = useGridEdit({
    fieldDefByKey,
    dispatchWrite,
    onAnnounce: setAnnounce,
    hasWriteHandler: Boolean(onWrite),
  });

  // History is in-memory per session (PoC L6.3). Phase 2: prefer the
  // consumer-supplied sessionKey so history survives the rows-identity
  // change that TanStack Query produces after every successful write
  // (the row-insert / row-delete acceptance criteria require ⌘Z to work
  // across that cycle). When no sessionKey is provided we fall back to
  // the Phase 0 rule (clear on rows-identity change) for compatibility
  // with consumers that haven't adopted the key yet.
  useEffect(() => {
    history.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey ?? rows]);

  const tanstackColumns = useMemo<ColumnDef<TRow>[]>(
    () =>
      visibleColumnDefs.map((column) => ({
        id: column.id,
        header: column.header,
        accessorFn: column.accessor,
        cell: ({ row }) =>
          column.render?.(row.original) ??
          formatDisplayCellValue(column.accessor(row.original), fieldDefByKey.get(column.fieldKey)),
      })),
    [fieldDefByKey, visibleColumnDefs],
  );
  const table = useReactTable<TRow>({
    data: filteredRows,
    columns: tanstackColumns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
  });

  const isGrouped = view.group.length > 0;
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Phase 3 §4.9: short-circuit pointer drag when the mousedown source
  // lives inside the active editor (inline <input> or single-select
  // popover). Lets native text-selection inside the editor work
  // without interference from the cell-drag hook.
  const isPointerInActiveEditor = useCallback(
    (target: EventTarget | null) => {
      if (!edit.editing) return false;
      if (!(target instanceof Element)) return false;
      if (target.closest(".data-table-cell-editor")) return true;
      if (target.closest(".single-select-popover")) return true;
      return false;
    },
    [edit.editing],
  );
  const pointerDrag = useGridPointerDrag({
    containerRef: wrapperRef,
    selection,
    isPointerInActiveEditor,
  });
  // Refocuses the grid wrapper so subsequent keyboard shortcuts (⌘Z,
  // ⌘C, arrows) route through onKeyDown rather than the browser's
  // default for whichever element happened to receive focus from the
  // last click. Without this, ⌘Z after an edit commit lands on the
  // page body and the browser interprets it (back/tab-undo).
  const focusGrid = () => {
    wrapperRef.current?.focus({ preventScroll: true });
  };
  const clipboard = useGridClipboard({
    range: selection.range,
    rows: filteredRows,
    columns: visibleColumnDefs,
    fieldDefs,
    getRowId,
    onWrite,
    dispatchWrite,
    onAnnounce: setAnnounce,
  });

  const canInsertRow = Boolean(buildEmptyRow) && !readOnly && Boolean(onWrite);
  const insertRowBelowActive = useCallback(async () => {
    if (!canInsertRow || !buildEmptyRow) {
      setAnnounce("Row insert is not enabled for this table.");
      return;
    }
    // Commit any pending edit first; abort if the commit failed
    // (validation blocked the cell write).
    if (edit.editing) {
      const committed = await edit.commit();
      if (!committed) return;
    }
    const anchorRow = filteredRows[selection.activeCell.rowIndex] ?? null;
    const anchorRowId = anchorRow ? getRowId(anchorRow) : null;
    const fieldDefaults = anchorRow
      ? extractRowDefaults(anchorRow, fieldDefs, visibleColumnDefs)
      : buildEmptyRowDefaults(fieldDefs);
    const tmpId = generateRowId?.() ?? `tmp_${generatedId("row")}`;
    const newRow = buildEmptyRow({ rowId: tmpId, fieldDefaults, anchorRow });
    const firstEditableFieldKey = pickFirstEditableFieldKey(visibleColumnDefs, fieldDefByKey);

    const op: WriteOp = {
      kind: "rowInsert",
      rows: [{ rowId: tmpId, fieldDefaults, anchorRowId }],
    };
    const inverse: WriteOp = {
      kind: "rowDelete",
      rows: [{ rowId: tmpId, row: newRow, anchorRowId }],
    };
    try {
      await dispatchWrite(op, inverse);
      if (firstEditableFieldKey) {
        const initialValue =
          fieldDefaults[firstEditableFieldKey] ??
          fieldDefByKey.get(firstEditableFieldKey)?.default ??
          "";
        edit.queuePendingEdit({
          rowId: tmpId,
          fieldKey: firstEditableFieldKey,
          initialValue,
        });
      }
      setAnnounce("Row inserted.");
    } catch (error) {
      setAnnounce(error instanceof Error ? error.message : "Row insert failed.");
    }
  }, [
    buildEmptyRow,
    canInsertRow,
    dispatchWrite,
    edit,
    fieldDefByKey,
    fieldDefs,
    filteredRows,
    generateRowId,
    getRowId,
    selection.activeCell.rowIndex,
    visibleColumnDefs,
  ]);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const deleteSelectedRows = useCallback(async () => {
    if (rowSelection.count === 0 || readOnly || !onWrite) return;
    const targets: { row: TRow; rowId: string; index: number }[] = [];
    filteredRows.forEach((row, index) => {
      const rowId = getRowId(row);
      if (rowSelection.isSelected(rowId)) targets.push({ row, rowId, index });
    });
    if (targets.length === 0) return;
    const deletes: RowDeletePayload[] = targets.map(({ row, rowId, index }) => ({
      rowId,
      row,
      anchorRowId: index > 0 ? (rowIds[index - 1] ?? null) : null,
    }));
    const op: WriteOp = { kind: "rowDelete", rows: deletes };
    const inverse: WriteOp = {
      kind: "rowInsert",
      rows: targets.map(({ row, rowId, index }) => ({
        rowId,
        anchorRowId: index > 0 ? (rowIds[index - 1] ?? null) : null,
        fieldDefaults: extractRowDefaults(row, fieldDefs, visibleColumnDefs),
      })),
    };
    try {
      await dispatchWrite(op, inverse);
      const count = deletes.length;
      setAnnounce(`${count} row${count === 1 ? "" : "s"} deleted.`);
      rowSelection.clear();
    } catch (error) {
      setAnnounce(error instanceof Error ? error.message : "Row delete failed.");
    }
  }, [
    dispatchWrite,
    fieldDefs,
    filteredRows,
    getRowId,
    onWrite,
    readOnly,
    rowIds,
    rowSelection,
    visibleColumnDefs,
  ]);

  // Pending-edit handoff (Phase 2 §4.4). Once the inserted row lands
  // in the next render's rowIds, consumePendingEdit calls edit.start on
  // the new row's first editable cell.
  useEffect(() => {
    edit.consumePendingEdit(rowIds);
  }, [edit, rowIds]);

  const keyboard = useGridKeyboard({
    selection,
    edit,
    readOnly,
    isGrouped,
    onCopy: clipboard.copy,
    onUndo: () =>
      void undoOnce().catch((error) => {
        setAnnounce(error instanceof Error ? error.message : "Undo failed.");
      }),
    onRedo: () =>
      void redoOnce().catch((error) => {
        setAnnounce(error instanceof Error ? error.message : "Redo failed.");
      }),
    onRowOpen: onRowOpen
      ? () => {
          const row = filteredRows[selection.activeCell.rowIndex];
          if (row) onRowOpen(row);
        }
      : undefined,
    onRowInsertBelowActive: canInsertRow ? insertRowBelowActive : undefined,
    drag: { isDragging: pointerDrag.isDragging, cancel: pointerDrag.cancel },
  });

  const toggleSort = (fieldKey: string) => {
    const current = view.sort.find((rule) => rule.fieldKey === fieldKey);
    const nextDirection: "asc" | "desc" = current?.direction === "asc" ? "desc" : "asc";
    onViewChange({ ...view, sort: [{ fieldKey, direction: nextDirection }] });
    const fieldName =
      fieldDefs.find((field) => field.field_key === fieldKey)?.display_name ?? fieldKey;
    setAnnounce(`Sorted by ${fieldName} ${nextDirection}.`);
    focusGrid();
  };

  const startInlineEdit = (row: TRow, columnIndex: number) => {
    const column = visibleColumnDefs[columnIndex];
    const fieldDef = column ? fieldDefByKey.get(column.fieldKey) : undefined;
    const editorKind = getFieldEditor(fieldDef).kind;
    if (readOnly || !onWrite || !column || editorKind === "none") {
      onRowOpen?.(row);
      return;
    }
    edit.start({
      rowId: getRowId(row),
      fieldKey: column.fieldKey,
      initialValue: column.accessor(row),
      intent: "extend",
    });
  };

  const handleCommitAndMove = (rowIndex: number, columnIndex: number, shiftKey: boolean) => {
    const next = moveTabCell(
      { rowIndex, columnIndex },
      shiftKey,
      filteredRows.length,
      visibleColumnDefs.length,
    );
    const nextRowId = rowIds[next.rowIndex];
    const nextFieldKey = fieldKeys[next.columnIndex];
    if (nextRowId !== undefined && nextFieldKey !== undefined) {
      selection.setActive({ rowId: nextRowId, fieldKey: nextFieldKey });
    }
    focusGrid();
  };

  const handlePasteEvent = (event: ClipboardEvent<HTMLDivElement>) => {
    if (readOnly || isGrouped) return;
    if (edit.editing) return;
    const tsv = event.clipboardData.getData("text/plain");
    if (!tsv) return;
    event.preventDefault();
    void clipboard.pasteText(tsv);
  };

  const toolbarActions =
    !readOnly && rowSelection.count > 0 ? (
      <button
        type="button"
        aria-label={`Delete ${rowSelection.count} selected row${rowSelection.count === 1 ? "" : "s"}`}
        onClick={() => setDeleteDialogOpen(true)}
      >
        Delete {rowSelection.count} {rowSelection.count === 1 ? "row" : "rows"}
      </button>
    ) : null;

  return (
    <div className={`data-table-shell data-table-shell-${density}`}>
      <GridToolbar readOnly={readOnly} view={view} actions={toolbarActions} />
      <ConfirmRowDeleteDialog
        open={deleteDialogOpen}
        count={rowSelection.count}
        onCancel={() => {
          setDeleteDialogOpen(false);
          focusGrid();
        }}
        onConfirm={() => {
          setDeleteDialogOpen(false);
          void deleteSelectedRows().then(() => focusGrid());
        }}
      />
      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
      <div
        ref={wrapperRef}
        className="data-table-wrap"
        role="grid"
        aria-rowcount={filteredRows.length + 1}
        aria-colcount={visibleColumnDefs.length}
        tabIndex={0}
        onKeyDown={keyboard.onKeyDown}
        onPaste={handlePasteEvent}
      >
        <table className="data-table">
          {/* Propagate column widths to every row so the sticky frozen
              cell renders at the same horizontal position as its header.
              Without a colgroup, the body cell width is auto-derived and
              the sticky `left: 42px` cell overlaps the adjacent column. */}
          <colgroup>
            <col className="data-table-gutter-col" />
            {visibleColumnDefs.map((column) => (
              <col
                key={column.id}
                style={column.width ? { width: `${column.width}px` } : undefined}
              />
            ))}
          </colgroup>
          <GridHeader
            table={table}
            visibleColumnDefs={visibleColumnDefs}
            fieldDefByKey={fieldDefByKey}
            sort={view.sort}
            onToggleSort={toggleSort}
            onColumnMouseDown={pointerDrag.onColumnMouseDown}
            renderHeaderActions={renderHeaderActions}
          />
          <GridBody
            table={table}
            visibleColumnDefs={visibleColumnDefs}
            fieldDefByKey={fieldDefByKey}
            rowIds={rowIds}
            fieldKeys={fieldKeys}
            normalizedActiveRange={selection.normalizedRange}
            hasExplicitRange={selection.hasExplicitRange}
            activeCell={selection.activeCell}
            edit={edit}
            rowSelection={rowSelection}
            showRowCheckbox={!readOnly}
            emptyMessage={emptyMessage}
            totalRowCount={rows.length}
            onCellActivate={(rowId, fieldKey) => {
              selection.setActive({ rowId, fieldKey });
              focusGrid();
            }}
            onCellMouseDown={pointerDrag.onCellMouseDown}
            onCellOpen={startInlineEdit}
            onRowSelect={(rowId) => {
              selection.selectRow(rowId);
              focusGrid();
            }}
            onRowToggleSelected={(rowId, mode) => {
              rowSelection.toggle(rowId, mode);
              focusGrid();
            }}
            onCommitAndMove={handleCommitAndMove}
          />
        </table>
      </div>
    </div>
  );
}

function pickFirstEditableFieldKey(
  visibleColumns: { fieldKey: string }[],
  fieldDefByKey: Map<string, FieldDef>,
): string | null {
  for (const column of visibleColumns) {
    const fieldDef = fieldDefByKey.get(column.fieldKey);
    if (!fieldDef || fieldDef.read_only) continue;
    if (getFieldEditor(fieldDef).kind === "none") continue;
    return column.fieldKey;
  }
  return null;
}

function moveTabCell(
  active: CellCoord,
  shiftKey: boolean,
  rowCount: number,
  columnCount: number,
): CellCoord {
  if (rowCount === 0 || columnCount === 0) return active;
  const offset = shiftKey ? -1 : 1;
  const flattened = active.rowIndex * columnCount + active.columnIndex;
  const next = Math.min(Math.max(flattened + offset, 0), rowCount * columnCount - 1);
  return {
    rowIndex: Math.floor(next / columnCount),
    columnIndex: next % columnCount,
  };
}
