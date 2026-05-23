import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { applyTextFilters, formatDisplayCellValue, sortRows } from "./lib";
import { useGridHistory } from "./hooks/useGridHistory";
import { useGridWriteReducer } from "./hooks/useGridWriteReducer";
import { useGridSelection } from "./hooks/useGridSelection";
import { useGridEdit } from "./hooks/useGridEdit";
import { getFieldEditor } from "./fields/registry";
import { useGridKeyboard } from "./hooks/useGridKeyboard";
import { useGridClipboard } from "./hooks/useGridClipboard";
import { GridHeader } from "./components/GridHeader";
import { GridBody } from "./components/GridBody";
import type { CellCoord, DataTableProps } from "./types";

export function DataTable<TRow>({
  rows,
  getRowId,
  fieldDefs,
  columnDefs,
  view,
  onViewChange,
  onWrite,
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
        applyTextFilters(rows, visibleColumnDefs, fieldDefs, view.filter),
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
  const edit = useGridEdit({
    fieldDefByKey,
    dispatchWrite,
    onAnnounce: setAnnounce,
    hasWriteHandler: Boolean(onWrite),
  });

  // History is in-memory per session (PoC L6.3); clear when the rows
  // identity changes — switching projects, sub-tabs, or refetching the
  // table all hand us a fresh rows array.
  useEffect(() => {
    history.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

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

  if (rows.length === 0) {
    return <div className="data-table-empty">{emptyMessage}</div>;
  }

  return (
    <div className={`data-table-shell data-table-shell-${density}`}>
      <div className="data-table-toolbar" aria-label="Table view controls">
        <span>{readOnly ? "Read-only" : "Editable"}</span>
        <span>{view.filter.length ? `Filtered by ${view.filter.length} rule` : "No filters"}</span>
        <span>{view.group.length ? "Ungroup to paste" : "Ungrouped"}</span>
        <span>{view.sort.length ? `Sorted by ${view.sort.length} field` : "Unsorted"}</span>
      </div>
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
            renderHeaderActions={renderHeaderActions}
          />
          <GridBody
            table={table}
            visibleColumnDefs={visibleColumnDefs}
            rowIds={rowIds}
            fieldKeys={fieldKeys}
            normalizedActiveRange={selection.normalizedRange}
            activeCell={selection.activeCell}
            edit={edit}
            onCellActivate={(rowId, fieldKey) => {
              selection.setActive({ rowId, fieldKey });
              focusGrid();
            }}
            onCellOpen={startInlineEdit}
            onRowSelect={(rowId) => {
              selection.selectRow(rowId);
              focusGrid();
            }}
            onCommitAndMove={handleCommitAndMove}
          />
        </table>
      </div>
    </div>
  );
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
