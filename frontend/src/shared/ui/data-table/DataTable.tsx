import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import {
  applyFilters,
  buildEmptyRowDefaults,
  effectiveSortFromView,
  extractRowDefaults,
  formatDisplayCellValue,
  pruneExpandedGroups,
  sortRows,
} from "./lib";
import { generatedId } from "../../lib/ids";
import { useGridHistory } from "./hooks/useGridHistory";
import { useGridWriteReducer } from "./hooks/useGridWriteReducer";
import { useGridSelection } from "./hooks/useGridSelection";
import { useGridRowSelection } from "./hooks/useGridRowSelection";
import { useGridEdit } from "./hooks/useGridEdit";
import { getFieldEditor } from "./fields/registry";
import { getFilterOperators, isFilterContributing } from "./fields/filterOperators";
import { useGridKeyboard } from "./hooks/useGridKeyboard";
import { useGridPointerDrag } from "./hooks/useGridPointerDrag";
import { useGridClipboard } from "./hooks/useGridClipboard";
import { GridHeader } from "./components/GridHeader";
import { GridBody } from "./components/GridBody";
import { GridToolbar } from "./components/GridToolbar";
import { ConfirmRowDeleteDialog } from "./components/ConfirmRowDeleteDialog";
import { FieldEditorPopover } from "./components/FieldEditorPopover";
import type {
  AxisRoleSubset,
  CellCoord,
  DataTableProps,
  FieldDef,
  FilterCondition,
  GroupRule,
  RowDeletePayload,
  SortRule,
  WriteOp,
} from "./types";
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
  // Phase 6 §4.5: group rules force a pre-sort prepended to the user-
  // intent `view.sort`. `effectiveSortFromView` dedups so a field
  // present in both axes only appears once in the comparator (group
  // direction wins). `view.sort` itself is preserved unchanged.
  const effectiveSort = useMemo(
    () => effectiveSortFromView(view),
    [view],
  );
  const filteredRows = useMemo(
    () =>
      sortRows(
        applyFilters(rows, visibleColumnDefs, fieldDefs, view.filter),
        visibleColumnDefs,
        fieldDefs,
        effectiveSort,
      ),
    [rows, visibleColumnDefs, fieldDefs, view.filter, effectiveSort],
  );
  const rowIds = useMemo(() => filteredRows.map(getRowId), [filteredRows, getRowId]);
  const fieldKeys = useMemo(
    () => visibleColumnDefs.map((column) => column.fieldKey),
    [visibleColumnDefs],
  );

  const [announce, setAnnounce] = useState("");
  const [fieldEditorOpenForFieldKey, setFieldEditorOpenForFieldKey] = useState<string | null>(null);
  const headerCellRefByFieldKey = useRef(new Map<string, HTMLTableCellElement>()).current;
  // Discard a staged field-editor edit when fieldDefs reidentifies
  // (post-save refetch, remote broadcast, session switch).
  useEffect(() => {
    setFieldEditorOpenForFieldKey(null);
  }, [fieldDefs]);
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

  // Phase 4 §4.11: fields the FilterPopover offers in its field picker.
  // `read_only` does NOT exclude the field — filtering on a computed
  // column is a real use case (§12 Q2). `attachment` / `argb_color`
  // are excluded because the registry returns no operators for them.
  const filterableFieldDefs = useMemo(
    () => fieldDefs.filter((fieldDef) => getFilterOperators(fieldDef).length > 0),
    [fieldDefs],
  );
  // Phase 4 §4.11: sortable fields exclude only `attachment` and
  // `argb_color` (they have no meaningful order). Read-only computed
  // columns sort fine. Phase 6: groupable shares the same rule.
  const sortableFieldDefs = useMemo(
    () =>
      fieldDefs.filter(
        (fieldDef) => fieldDef.field_type !== "attachment" && fieldDef.field_type !== "argb_color",
      ),
    [fieldDefs],
  );
  const groupableFieldDefs = sortableFieldDefs;
  const handleFilterChange = useCallback(
    (next: FilterCondition[]) => {
      onViewChange({ ...view, filter: next });
    },
    [onViewChange, view],
  );
  const handleSortChange = useCallback(
    (next: SortRule[]) => {
      onViewChange({ ...view, sort: next });
    },
    [onViewChange, view],
  );
  // Phase 6 §4.10: group changes prune expandedGroups whose path depth
  // exceeds the new group depth (so old deep keys don't accumulate).
  // Same-or-shorter paths stay — re-grouping by a different field at
  // the same depth keeps state in place (acceptable; clears on Reset).
  const handleGroupChange = useCallback(
    (next: GroupRule[]) => {
      onViewChange({
        ...view,
        group: next,
        expandedGroups: pruneExpandedGroups(view.expandedGroups, next),
      });
    },
    [onViewChange, view],
  );
  // Phase 6 §4.2 / §12 Q15: Collapse all / Expand all live in the
  // Group popover header, not the toolbar overflow. Collapse-all
  // requires knowing every current group's pathKey, which lives in
  // the body plan — Step 4 wires that up. For Step 3, the handlers
  // exist but only operate on the user-intent map: Expand-all clears
  // `expandedGroups` (defaults all paths to expanded); Collapse-all
  // is a no-op until Step 4 supplies the visible pathKeys.
  const handleExpandAllGroups = useCallback(() => {
    if (Object.keys(view.expandedGroups).length === 0) return;
    onViewChange({ ...view, expandedGroups: {} });
  }, [onViewChange, view]);
  const handleCollapseAllGroups = useCallback(() => {
    // Step 4 replaces this with a pathKey-aware implementation.
    if (view.group.length === 0) return;
    onViewChange({ ...view });
  }, [onViewChange, view]);
  // Phase 6 §4.4: Reset clears every view-state key the toolbar can
  // mutate — filter / sort / group / aggregations / expandedGroups.
  // Column order / hidden columns / column widths are owned by a
  // future column-config phase and stay untouched.
  const handleResetView = useCallback(() => {
    onViewChange({
      ...view,
      filter: [],
      sort: [],
      group: [],
      aggregations: {},
      expandedGroups: {},
    });
  }, [onViewChange, view]);
  const canResetView =
    view.filter.length > 0 ||
    view.sort.length > 0 ||
    view.group.length > 0 ||
    Object.keys(view.aggregations).length > 0 ||
    Object.keys(view.expandedGroups).length > 0;

  // Phase 6 §4.3.2: per-column subset code over {filter, sort, group}.
  // Filter membership requires the rule to be contributing (dormant
  // rules don't tint, matching AirTable). Sort and group always count
  // as soon as a rule exists. Codes concatenate the present axes'
  // first letters in fixed order (f < s < g) so two callers can never
  // disagree. Absence == untinted.
  const axisRolesByFieldKey = useMemo<Map<string, AxisRoleSubset>>(() => {
    const map = new Map<string, AxisRoleSubset>();
    const filterContributing = new Set(
      view.filter.filter((rule) => isFilterContributing(rule)).map((rule) => rule.fieldKey),
    );
    const sortKeys = new Set(view.sort.map((rule) => rule.fieldKey));
    const groupKeys = new Set(view.group.map((rule) => rule.fieldKey));
    const allKeys = new Set<string>([...filterContributing, ...sortKeys, ...groupKeys]);
    for (const fieldKey of allKeys) {
      let code = "";
      if (filterContributing.has(fieldKey)) code += "f";
      if (sortKeys.has(fieldKey)) code += "s";
      if (groupKeys.has(fieldKey)) code += "g";
      if (code) map.set(fieldKey, code as AxisRoleSubset);
    }
    return map;
  }, [view.filter, view.sort, view.group]);

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

  const fieldEditorContext = useMemo(() => {
    if (!fieldEditorOpenForFieldKey) return null;
    const fieldDef = fieldDefByKey.get(fieldEditorOpenForFieldKey);
    const column = columnDefs.find((c) => c.fieldKey === fieldEditorOpenForFieldKey);
    if (!fieldDef || !column) return null;
    return { fieldDef, column };
  }, [columnDefs, fieldDefByKey, fieldEditorOpenForFieldKey]);

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
      <GridToolbar
        readOnly={readOnly}
        view={view}
        fieldDefByKey={fieldDefByKey}
        filterableFieldDefs={filterableFieldDefs}
        sortableFieldDefs={sortableFieldDefs}
        groupableFieldDefs={groupableFieldDefs}
        onFilterChange={handleFilterChange}
        onSortChange={handleSortChange}
        onGroupChange={handleGroupChange}
        onCollapseAllGroups={handleCollapseAllGroups}
        onExpandAllGroups={handleExpandAllGroups}
        onResetView={handleResetView}
        canResetView={canResetView}
        actions={toolbarActions}
      />
      {fieldEditorContext ? (
        <FieldEditorPopover<TRow>
          open
          onOpenChange={(next) => {
            if (!next) {
              setFieldEditorOpenForFieldKey(null);
              focusGrid();
            }
          }}
          fieldDef={fieldEditorContext.fieldDef}
          rows={rows}
          getRowId={getRowId}
          accessor={fieldEditorContext.column.accessor}
          anchorElement={headerCellRefByFieldKey.get(fieldEditorContext.fieldDef.field_key) ?? null}
          dispatchWrite={dispatchWrite}
        />
      ) : null}
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
            axisRolesByFieldKey={axisRolesByFieldKey}
            onColumnMouseDown={pointerDrag.onColumnMouseDown}
            readOnly={readOnly}
            hasWriteHandler={Boolean(onWrite)}
            onEditField={setFieldEditorOpenForFieldKey}
            openFieldKey={fieldEditorOpenForFieldKey}
            headerCellRefByFieldKey={headerCellRefByFieldKey}
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
            axisRolesByFieldKey={axisRolesByFieldKey}
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
