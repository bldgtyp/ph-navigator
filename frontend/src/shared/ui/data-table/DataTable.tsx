import { useMemo, useState, type KeyboardEvent } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import {
  applyTextFilters,
  clampRange,
  coerceFieldValue,
  coercePasteWrites,
  formatClipboardValue,
  formatDisplayCellValue,
  isCellInNormalizedRange,
  moveActiveCell,
  normalizeRange,
  parseTsv,
  planPaste,
  rangeToHtml,
  rangeToTsv,
  sortRows,
} from "./lib";
import type { CellCoord, CellRange, DataTableProps, FieldDef } from "./types";

type EditingCell = {
  rowId: string;
  rowIndex: number;
  columnIndex: number;
  fieldKey: string;
  draftValue: string;
  originalValue: unknown;
};

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
  const [activeCell, setActiveCell] = useState<CellCoord>({ rowIndex: 0, columnIndex: 0 });
  const [selection, setSelection] = useState<CellRange | null>(null);
  const [announce, setAnnounce] = useState("");
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

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

  const activeRange = useMemo(
    () =>
      clampRange(
        selection ?? { anchor: activeCell, focus: activeCell },
        filteredRows.length,
        visibleColumnDefs.length,
      ),
    [activeCell, filteredRows.length, selection, visibleColumnDefs.length],
  );
  const normalizedActiveRange = useMemo(() => normalizeRange(activeRange), [activeRange]);
  const activeCellInView = activeRange.focus;
  const isGrouped = view.group.length > 0;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return;
    if (editingCell) return;
    if (isCommandShortcut(event) && event.key.toLowerCase() === "c") {
      event.preventDefault();
      void copySelection(filteredRows, visibleColumnDefs, fieldDefs, activeRange);
      return;
    }
    if (isCommandShortcut(event) && event.key.toLowerCase() === "v") {
      if (readOnly || isGrouped) return;
      event.preventDefault();
      void pasteIntoSelection(
        activeRange,
        filteredRows,
        visibleColumnDefs,
        fieldDefs,
        getRowId,
        onWrite,
        setAnnounce,
      );
      return;
    }
    if (isCommandShortcut(event) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      const next = selectAllRange(filteredRows.length, visibleColumnDefs.length);
      if (next) {
        setActiveCell(next.anchor);
        setSelection(next);
      }
      return;
    }
    if (event.key === "Enter" && onRowOpen) {
      const row = filteredRows[activeCellInView.rowIndex];
      if (!row) return;
      event.preventDefault();
      onRowOpen(row);
      return;
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = moveActiveCell(
        activeCellInView,
        event.key,
        filteredRows.length,
        visibleColumnDefs.length,
      );
      if (next === activeCellInView) return;
      setActiveCell(next);
      setSelection(event.shiftKey ? { anchor: activeRange.anchor, focus: next } : null);
    }
  };

  const toggleSort = (fieldKey: string) => {
    const current = view.sort.find((rule) => rule.fieldKey === fieldKey);
    const nextDirection: "asc" | "desc" = current?.direction === "asc" ? "desc" : "asc";
    const next = { ...view, sort: [{ fieldKey, direction: nextDirection }] };
    onViewChange(next);
    const fieldName =
      fieldDefs.find((field) => field.field_key === fieldKey)?.display_name ?? fieldKey;
    setAnnounce(`Sorted by ${fieldName} ${nextDirection}.`);
  };

  const startInlineEdit = (row: TRow, rowIndex: number, columnIndex: number) => {
    const column = visibleColumnDefs[columnIndex];
    const fieldDef = column ? fieldDefByKey.get(column.fieldKey) : undefined;
    if (readOnly || !onWrite || !column || !isInlineEditableField(fieldDef)) {
      onRowOpen?.(row);
      return;
    }
    setEditingCell({
      rowId: getRowId(row),
      rowIndex,
      columnIndex,
      fieldKey: column.fieldKey,
      draftValue: formatClipboardValue(column.accessor(row)),
      originalValue: column.accessor(row),
    });
  };

  const commitInlineEdit = async (): Promise<boolean> => {
    if (!editingCell || !onWrite) return false;
    const fieldDef = fieldDefByKey.get(editingCell.fieldKey);
    const coerced = coerceFieldValue(editingCell.draftValue, fieldDef, () => [], {
      emptyNumberValue: 0,
    });
    if (!coerced.ok) {
      setAnnounce(coerced.message);
      return false;
    }
    if (coerced.value === editingCell.originalValue) {
      setEditingCell(null);
      return true;
    }
    try {
      await onWrite({
        kind: "cell",
        writes: [
          {
            rowId: editingCell.rowId,
            fieldKey: editingCell.fieldKey,
            value: coerced.value,
          },
        ],
      });
      setAnnounce(`${fieldDef?.display_name ?? editingCell.fieldKey} updated.`);
      setEditingCell(null);
      return true;
    } catch (error) {
      setAnnounce(error instanceof Error ? error.message : "Cell update failed.");
      return false;
    }
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
        className="data-table-wrap"
        role="grid"
        aria-rowcount={filteredRows.length + 1}
        aria-colcount={visibleColumnDefs.length}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} role="row" aria-rowindex={1}>
                <th className="data-table-gutter" aria-label="Row number" />
                {headerGroup.headers.map((header, columnIndex) => {
                  const column = visibleColumnDefs[columnIndex];
                  return (
                    <th
                      key={header.id}
                      role="columnheader"
                      aria-colindex={columnIndex + 1}
                      className={columnIndex === 0 ? "data-table-frozen" : undefined}
                      style={{ width: column?.width }}
                    >
                      <button
                        type="button"
                        className="data-table-header-button"
                        tabIndex={-1}
                        onClick={() => {
                          if (column) toggleSort(column.fieldKey);
                        }}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
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
          <tbody>
            {filteredRows.length === 0 ? (
              <tr role="row" aria-rowindex={2}>
                <td className="data-table-filter-empty" colSpan={visibleColumnDefs.length + 1}>
                  No rows match the current table view.
                </td>
              </tr>
            ) : null}
            {table.getRowModel().rows.map((row, rowIndex) => (
              <tr key={row.id} role="row" aria-rowindex={rowIndex + 2}>
                <th className="data-table-gutter" scope="row">
                  <button
                    type="button"
                    aria-label={`Select row ${rowIndex + 1}`}
                    tabIndex={-1}
                    onClick={() => {
                      const range = {
                        anchor: { rowIndex, columnIndex: 0 },
                        focus: { rowIndex, columnIndex: visibleColumnDefs.length - 1 },
                      };
                      setActiveCell(range.anchor);
                      setSelection(range);
                    }}
                  >
                    {rowIndex + 1}
                  </button>
                </th>
                {row.getVisibleCells().map((cell, columnIndex) => {
                  const selected = isCellInNormalizedRange(
                    { rowIndex, columnIndex },
                    normalizedActiveRange,
                  );
                  const active =
                    activeCellInView.rowIndex === rowIndex &&
                    activeCellInView.columnIndex === columnIndex;
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
                        const next = { rowIndex, columnIndex };
                        setActiveCell(next);
                        setSelection(null);
                      }}
                      onDoubleClick={() => startInlineEdit(row.original, rowIndex, columnIndex)}
                    >
                      {editingCell?.rowId === row.id &&
                      editingCell.columnIndex === columnIndex &&
                      editingCell.rowIndex === rowIndex ? (
                        <InlineCellEditor
                          value={editingCell.draftValue}
                          onChange={(draftValue) => setEditingCell({ ...editingCell, draftValue })}
                          onCancel={() => setEditingCell(null)}
                          onCommit={() => void commitInlineEdit()}
                          onCommitAndMove={(shiftKey) => {
                            void commitInlineEdit().then((committed) => {
                              if (!committed) return;
                              setActiveCell(
                                moveTabCell(
                                  { rowIndex, columnIndex },
                                  shiftKey,
                                  filteredRows.length,
                                  visibleColumnDefs.length,
                                ),
                              );
                              setSelection(null);
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
        </table>
      </div>
    </div>
  );
}

function InlineCellEditor({
  value,
  onChange,
  onCancel,
  onCommit,
  onCommitAndMove,
}: {
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onCommit: () => void;
  onCommitAndMove: (shiftKey: boolean) => void;
}) {
  return (
    <input
      className="data-table-cell-editor"
      autoFocus
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCancel}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          onCancel();
        }
        if (event.key === "Tab") {
          event.preventDefault();
          onCommitAndMove(event.shiftKey);
        }
        if (event.key === "Enter") {
          event.preventDefault();
          onCommit();
        }
      }}
    />
  );
}

function isInlineEditableField(fieldDef: FieldDef | undefined): boolean {
  return (
    !fieldDef?.read_only && (fieldDef?.field_type === "text" || fieldDef?.field_type === "number")
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

async function copySelection<TRow>(
  rows: TRow[],
  columns: DataTableProps<TRow>["columnDefs"],
  fieldDefs: DataTableProps<TRow>["fieldDefs"],
  range: CellRange,
) {
  const tsv = rangeToTsv(rows, columns, fieldDefs, range);
  const html = rangeToHtml(rows, columns, fieldDefs, range);
  if ("ClipboardItem" in window && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/plain": new Blob([tsv], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" }),
      }),
    ]);
    return;
  }
  await navigator.clipboard?.writeText(tsv);
}

function isCommandShortcut(event: KeyboardEvent<HTMLDivElement>): boolean {
  return event.metaKey || event.ctrlKey;
}

function selectAllRange(rowCount: number, columnCount: number): CellRange | null {
  if (rowCount === 0 || columnCount === 0) return null;
  return {
    anchor: { rowIndex: 0, columnIndex: 0 },
    focus: { rowIndex: rowCount - 1, columnIndex: columnCount - 1 },
  };
}

async function pasteIntoSelection<TRow>(
  range: CellRange,
  rows: TRow[],
  columns: DataTableProps<TRow>["columnDefs"],
  fieldDefs: DataTableProps<TRow>["fieldDefs"],
  getRowId: (row: TRow) => string,
  onWrite: DataTableProps<TRow>["onWrite"],
  setAnnounce: (message: string) => void,
) {
  if (!onWrite) {
    setAnnounce("Paste is not enabled for this table yet.");
    return;
  }
  const raw = await navigator.clipboard?.readText();
  if (!raw) return;
  const plan = planPaste({
    clipboard: parseTsv(raw),
    target: range,
    rowCount: rows.length,
    columnCount: columns.length,
  });
  if (plan.rowsOverflow) {
    setAnnounce(`Clipboard has ${plan.rowsOverflow} more rows. Add rows before paste.`);
    return;
  }
  if (plan.columnsOverflow) {
    setAnnounce(`Clipboard has ${plan.columnsOverflow} more columns. Extra columns dropped.`);
    return;
  }
  const coerced = coercePasteWrites({
    plannedWrites: plan.writes,
    rows,
    columns,
    fieldDefs,
    getRowId,
  });
  if (!coerced.ok) {
    const first = coerced.errors[0];
    setAnnounce(
      first
        ? `Paste blocked at row ${first.rowIndex + 1}, column ${first.columnIndex + 1}: ${first.message}`
        : "Paste blocked.",
    );
    return;
  }
  try {
    await onWrite({
      kind: "paste",
      writes: coerced.writes,
      rowsInserted: [],
      newOptions: coerced.newOptions,
    });
    setAnnounce(`${plan.writes.length} cells pasted.`);
  } catch (error) {
    setAnnounce(error instanceof Error ? error.message : "Paste failed.");
  }
}
