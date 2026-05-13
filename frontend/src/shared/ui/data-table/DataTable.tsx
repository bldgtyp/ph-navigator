import { useMemo, useState, type KeyboardEvent } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import {
  applyTextFilters,
  clampRange,
  formatClipboardValue,
  isCellInNormalizedRange,
  moveActiveCell,
  normalizeRange,
  parseTsv,
  planPaste,
  rangeToHtml,
  rangeToTsv,
  sortRows,
} from "./lib";
import type { CellCoord, CellRange, DataTableProps } from "./types";

export function DataTable<TRow>({
  rows,
  getRowId,
  fieldDefs,
  columnDefs,
  view,
  onViewChange,
  onWrite,
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
  const filteredRows = useMemo(
    () =>
      sortRows(
        applyTextFilters(rows, visibleColumnDefs, view.filter),
        visibleColumnDefs,
        view.sort,
      ),
    [rows, visibleColumnDefs, view.filter, view.sort],
  );
  const [activeCell, setActiveCell] = useState<CellCoord>({ rowIndex: 0, columnIndex: 0 });
  const [selection, setSelection] = useState<CellRange | null>(null);
  const [announce, setAnnounce] = useState("");

  const tanstackColumns = useMemo<ColumnDef<TRow>[]>(
    () =>
      visibleColumnDefs.map((column) => ({
        id: column.id,
        header: column.header,
        accessorFn: column.accessor,
        cell: ({ row }) =>
          column.render?.(row.original) ?? formatClipboardValue(column.accessor(row.original)),
      })),
    [visibleColumnDefs],
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
    if (isCommandShortcut(event) && event.key.toLowerCase() === "c") {
      event.preventDefault();
      void copySelection(filteredRows, visibleColumnDefs, activeRange);
      return;
    }
    if (isCommandShortcut(event) && event.key.toLowerCase() === "v") {
      if (readOnly || isGrouped) return;
      event.preventDefault();
      void pasteIntoSelection(
        activeRange,
        filteredRows,
        visibleColumnDefs,
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
                      onDoubleClick={() => onRowOpen?.(row.original)}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
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

async function copySelection<TRow>(
  rows: TRow[],
  columns: DataTableProps<TRow>["columnDefs"],
  range: CellRange,
) {
  const tsv = rangeToTsv(rows, columns, range);
  const html = rangeToHtml(rows, columns, range);
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
  await onWrite({
    kind: "paste",
    writes: plan.writes.flatMap((write) => {
      const row = rows[write.rowIndex];
      const column = columns[write.columnIndex];
      if (!row || !column) return [];
      return [{ rowId: getRowId(row), fieldKey: column.fieldKey, value: write.raw }];
    }),
    rowsInserted: [],
    newOptions: {},
  });
  setAnnounce(`${plan.writes.length} cells pasted.`);
}
