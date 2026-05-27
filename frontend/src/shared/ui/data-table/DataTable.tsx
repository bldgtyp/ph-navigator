// @size-exception: docs/code-reviews/2026-05-25/frontend-code-review.md#21-srp--file-length-violations
import "./DataTable.css";
import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { computeIdentifierDuplicates, recordIdColumnId } from "./lib/identifier/recordId";
import { applyFilters } from "./lib/filter/apply";
import { buildBodyPlan, groupPathByRowIdFromBodyPlan } from "./lib/body/plan";
import { computeAggregatesByPath } from "./lib/body/aggregates";
import { pruneExpandedGroups } from "./lib/body/prune";
import { effectiveSortFromView } from "./lib/view/sanitize";
import { buildEmptyRowDefaults, extractRowDefaults } from "./lib/rows/defaults";
import { formatDisplayCellValue } from "./lib/rows/format";
import { sortRows } from "./lib/sort/sortRows";
import { resolveColumnWidth } from "./lib/columnWidths";
import { buildSubsetCode } from "./tokens/data-table-tints";
import { generatedId } from "../../lib/ids";
import { stableEmptyArray } from "../../lib/stableEmpty";
import { useGridHistory } from "./hooks/useGridHistory";
import { useGridWriteReducer } from "./hooks/useGridWriteReducer";
import { useGridSelection } from "./hooks/useGridSelection";
import { useGridRowSelection } from "./hooks/useGridRowSelection";
import { useGridEdit } from "./hooks/useGridEdit";
import { getFieldEditor } from "./fields/registry";
import type { AggregationKind } from "./fields/aggregations";
import { getFilterOperators, isFilterContributing } from "./fields/filterOperators";
import { useGridKeyboard } from "./hooks/useGridKeyboard";
import { useGridPointerDrag } from "./hooks/useGridPointerDrag";
import { useGridClipboard } from "./hooks/useGridClipboard";
import { useGridFill } from "./hooks/useGridFill";
import { reorderColumnIds, useGridColumns } from "./hooks/useGridColumns";
import { useGridColumnDragKeyboard } from "./hooks/useGridColumnDragKeyboard";
import { useGridColumnResize } from "./hooks/useGridColumnResize";
import { DataTableErrorBoundary } from "./components/DataTableErrorBoundary";
import { GridHeader } from "./components/GridHeader";
import { GridBody } from "./components/GridBody";
import { SummaryBar } from "./components/SummaryBar";
import { GridToolbar } from "./components/GridToolbar";
import type { HideFieldsPanelChange } from "./components/HideFieldsPanel";
import { CreateFieldConfigModal } from "./components/CreateFieldConfigModal";
import { ConfirmDestructiveDialog } from "./components/ConfirmDestructiveDialog";
import { FieldConfigModal } from "./components/FieldConfigModal";
import type { FieldRegistryEntry } from "./lib/formula";
import { getCustomValue } from "./lib/customFieldAccessor";
import type {
  AddCustomFieldRequest,
  AxisRoleSubset,
  CellCoord,
  DataTableProps,
  EditCustomFieldBundleRequest,
  FieldDef,
  FilterCondition,
  GroupRule,
  RowDeletePayload,
  SortRule,
  WriteOp,
} from "./types";
// Identity-stable empty arrays for memo deps. Inline `[]` literals would
// invalidate `useGridColumns`'s memo and the formulaFieldRegistry default
// every render. Shared sentinel lives in `shared/lib/stableEmpty`.
const EMPTY_ID_LIST = stableEmptyArray<string>() as string[];
const EMPTY_FORMULA_FIELD_REGISTRY = stableEmptyArray<FieldRegistryEntry>();

export function DataTable<TRow>({
  rows,
  getRowId,
  fieldDefs: inputFieldDefs,
  columnDefs: inputColumnDefs,
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
  overflowMenuActions,
  footerAction,
  onResetView,
  onDeleteCustomField,
  onAddCustomField,
  onDuplicateCustomField,
  onEditCustomFieldBundle,
  formulaFieldRegistry,
  getFormulaRowValues,
}: DataTableProps<TRow>) {
  const columnDefs = inputColumnDefs;
  const fieldDefs = inputFieldDefs;
  const pinnedColumnId = useMemo(() => recordIdColumnId(columnDefs), [columnDefs]);
  const visibleColumnDefs = useGridColumns(
    columnDefs,
    view.columnOrder,
    view.hiddenColumns,
    pinnedColumnId,
  );
  // Hide-fields panel needs hidden columns too, so users can toggle
  // them back on — same hook with no hidden list applied.
  const orderedColumnsForHidePanel = useGridColumns(
    columnDefs,
    view.columnOrder,
    EMPTY_ID_LIST,
    pinnedColumnId,
  );
  const fieldDefByKey = useMemo(
    () => new Map(fieldDefs.map((fieldDef) => [fieldDef.field_key, fieldDef])),
    [fieldDefs],
  );
  const effectiveSort = useMemo(() => effectiveSortFromView(view), [view]);
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
  // Plan 30 §P5 / D13 — duplicate-value warning chip. O(n) over the
  // post-filter rows, keyed by identifier value; empty values do not
  // warn. Map row id → 1-indexed numbers of conflicting rows.
  const identifierDuplicates = useMemo(
    () =>
      computeIdentifierDuplicates({
        columns: visibleColumnDefs,
        rows: filteredRows,
        getRowId,
      }),
    [filteredRows, getRowId, visibleColumnDefs],
  );
  // Split aggregates and interleave into separate memos so a chevron
  // toggle (which only mutates `view.expandedGroups`) doesn't re-run
  // the aggregation pass.
  const aggregatesByPath = useMemo(
    () =>
      computeAggregatesByPath(filteredRows, visibleColumnDefs, fieldDefs, {
        group: view.group,
        aggregations: view.aggregations,
      }),
    [filteredRows, visibleColumnDefs, fieldDefs, view.group, view.aggregations],
  );
  const bodyPlan = useMemo(
    () =>
      buildBodyPlan(
        filteredRows,
        visibleColumnDefs,
        fieldDefs,
        getRowId,
        { group: view.group, expandedGroups: view.expandedGroups, aggregations: view.aggregations },
        aggregatesByPath,
      ),
    [
      filteredRows,
      visibleColumnDefs,
      fieldDefs,
      getRowId,
      view.group,
      view.expandedGroups,
      view.aggregations,
      aggregatesByPath,
    ],
  );
  // Selection / keyboard / clipboard operate on the data-row subset
  // of the body plan — collapsed-group rows are invisible to those
  // models. Group-header rows never enter `rowIds`, so the existing
  // `useGridSelection` clamp keeps the active cell on a visible row.
  const visibleDataRows = useMemo(
    () =>
      bodyPlan
        .filter((item): item is Extract<typeof item, { kind: "data" }> => item.kind === "data")
        .map((item) => item.row),
    [bodyPlan],
  );
  const rowIds = useMemo(() => visibleDataRows.map(getRowId), [visibleDataRows, getRowId]);
  const fieldKeys = useMemo(
    () => visibleColumnDefs.map((column) => column.fieldKey),
    [visibleColumnDefs],
  );

  const [announce, setAnnounce] = useState("");
  const headerCellRefByFieldKey = useRef(new Map<string, HTMLTableCellElement>()).current;
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
  // The TanStack table model is keyed on `visibleDataRows` so its row
  // model lines up 1:1 with the data items in `bodyPlan` and with
  // `rowIds` — keeping the selection / clipboard / keyboard models on
  // the visible data-row subset rather than the (filtered, unhidden)
  // full list (§4.6.1). Collapsed-group members are invisible to
  // every model that walks rows.
  const table = useReactTable<TRow>({
    data: visibleDataRows,
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
      if (!(target instanceof Element)) return false;
      // Mousedown on the fill handle is not "in an editor", but it must
      // still short-circuit the cell-drag path so useGridFill's session
      // can own the drag (Phase 7 §4.3).
      if (target.closest(".data-table-fill-handle")) return true;
      if (!edit.editing) return false;
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
  // Phase 7: per-data-row pathKey, derived once from the body plan. The
  // fill hook uses it to (a) hide the handle when the source spans
  // multiple groups, (b) clamp the drag target to the source group,
  // and (c) split a multi-group ⌘D selection into per-group sub-fills.
  const groupPathByRowId = useMemo(() => groupPathByRowIdFromBodyPlan(bodyPlan), [bodyPlan]);

  const fill = useGridFill({
    containerRef: wrapperRef,
    selection,
    rows: visibleDataRows,
    rowIds,
    fieldKeys,
    columns: visibleColumnDefs,
    fieldDefs,
    getRowId,
    groupPathByRowId,
    dispatchWrite,
    readOnly,
    isEditing: Boolean(edit.editing),
    hasWriteHandler: Boolean(onWrite),
    onAnnounce: setAnnounce,
  });

  const clipboard = useGridClipboard({
    range: selection.range,
    // Phase 6 §4.1: copy across a range that spans a collapsed group
    // emits only the visible data rows. Group-header rows never enter
    // the TSV / HTML output. Matches AirTable.
    rows: visibleDataRows,
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
    const anchorRow = visibleDataRows[selection.activeCell.rowIndex] ?? null;
    const anchorRowId = anchorRow ? getRowId(anchorRow) : null;
    // Plan 30 D10 — Shift-Enter creates a truly blank row. Field
    // defaults are sourced from `FieldDef.default` / natural zero
    // only — never cloned from the anchor row. The anchor's position
    // still places the new row below it; the anchor's *values* don't
    // travel. The explicit "Duplicate record" gesture (out of scope
    // for this plan) will reuse `buildEmptyRow` with anchor values.
    const fieldDefaults = buildEmptyRowDefaults(fieldDefs);
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
    visibleDataRows,
    generateRowId,
    getRowId,
    selection.activeCell.rowIndex,
    visibleColumnDefs,
  ]);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const deleteSelectedRows = useCallback(async () => {
    if (rowSelection.count === 0 || readOnly || !onWrite) return;
    const targets: { row: TRow; rowId: string; index: number }[] = [];
    visibleDataRows.forEach((row, index) => {
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
    visibleDataRows,
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

  // Inline-edit entry points. Defined before `useGridKeyboard` so the
  // keyboard hook closure can call them at render time.
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

  // Plan 04 — F2 / Enter open the editor on the active cell with the
  // prior value prefilled. Non-editable cells fall through to the
  // row-open gesture (inside startInlineEdit) so consumers wiring
  // onRowOpen keep their drawer.
  const beginEditActiveCell = () => {
    const row = visibleDataRows[selection.activeCell.rowIndex];
    if (!row) return;
    startInlineEdit(row, selection.activeCell.columnIndex);
  };

  // Replace-mode entry point for type-to-edit. `initialKey` is the typed
  // character ("K", "7", " ") or empty string for Backspace / Delete.
  const typeToEditActiveCell = (initialKey: string) => {
    const row = visibleDataRows[selection.activeCell.rowIndex];
    const column = visibleColumnDefs[selection.activeCell.columnIndex];
    if (!row || !column) return;
    const fieldDef = fieldDefByKey.get(column.fieldKey);
    const editorKind = getFieldEditor(fieldDef).kind;
    if (readOnly || !onWrite || editorKind === "none") {
      setAnnounce("This cell is read-only.");
      return;
    }
    selection.setActive({ rowId: getRowId(row), fieldKey: column.fieldKey });
    // Plan 05: single-select cells route through SingleSelectPopover
    // with the typed char pre-filling the search input. Trim the seed
    // so Space — which the keyboard hook treats as a printable char —
    // opens the popover with no filter (matches Enter / F2 / chevron
    // click); a single trailing space would otherwise filter to "no
    // matches" because option labels are stored trimmed. An empty
    // seed (Backspace / Delete) is a no-op on single-select to
    // preserve the prior "clearing is not how you change a select"
    // behavior — users open the popover instead.
    if (editorKind === "single_select") {
      const trimmed = initialKey.trim();
      if (initialKey === "" && trimmed === "") return;
      edit.start({
        rowId: getRowId(row),
        fieldKey: column.fieldKey,
        initialValue: column.accessor(row),
        intent: "replace",
        replaceSeed: trimmed,
      });
      return;
    }
    edit.start({
      rowId: getRowId(row),
      fieldKey: column.fieldKey,
      initialValue: column.accessor(row),
      intent: "replace",
      replaceSeed: initialKey,
    });
  };

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
          const row = visibleDataRows[selection.activeCell.rowIndex];
          if (row) onRowOpen(row);
        }
      : undefined,
    onBeginEdit: beginEditActiveCell,
    onPrintableKey: !readOnly && onWrite ? typeToEditActiveCell : undefined,
    onClearActiveCell: !readOnly && onWrite ? () => typeToEditActiveCell("") : undefined,
    onRowInsertBelowActive: canInsertRow ? insertRowBelowActive : undefined,
    onFillDown: !readOnly && Boolean(onWrite) ? fill.fillDown : undefined,
    onFillRight: !readOnly && Boolean(onWrite) ? fill.fillRight : undefined,
    onFillUp: !readOnly && Boolean(onWrite) ? fill.fillUp : undefined,
    onFillLeft: !readOnly && Boolean(onWrite) ? fill.fillLeft : undefined,
    drag: { isDragging: pointerDrag.isDragging, cancel: pointerDrag.cancel },
  });

  // `read_only` does NOT exclude a field — filtering on a computed
  // column is a real use case. attachment / argb_color are dropped
  // because the registry returns no operators for them.
  const filterableFieldDefs = useMemo(
    () => fieldDefs.filter((fieldDef) => getFilterOperators(fieldDef).length > 0),
    [fieldDefs],
  );
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
  const handleExpandAllGroups = useCallback(() => {
    if (Object.keys(view.expandedGroups).length === 0) return;
    onViewChange({ ...view, expandedGroups: {} });
  }, [onViewChange, view]);
  const handleCollapseAllGroups = useCallback(() => {
    if (view.group.length === 0 || aggregatesByPath.size === 0) return;
    const next: Record<string, boolean> = {};
    for (const pathKey of aggregatesByPath.keys()) next[pathKey] = false;
    onViewChange({ ...view, expandedGroups: next });
  }, [aggregatesByPath, onViewChange, view]);
  const handleToggleGroup = useCallback(
    (pathKey: string) => {
      const current = view.expandedGroups[pathKey] ?? true;
      onViewChange({
        ...view,
        expandedGroups: { ...view.expandedGroups, [pathKey]: !current },
      });
    },
    [onViewChange, view],
  );
  // `none` deletes the entry rather than storing it explicitly so the
  // map stays tight (absence == none in the body-plan walk).
  const handleAggregationChange = useCallback(
    (fieldKey: string, kind: AggregationKind) => {
      const current = view.aggregations[fieldKey] ?? "none";
      if (current === kind) return;
      const next = { ...view.aggregations };
      if (kind === "none") delete next[fieldKey];
      else next[fieldKey] = kind;
      onViewChange({ ...view, aggregations: next });
    },
    [onViewChange, view],
  );
  const handleHideFieldsChange = useCallback(
    (change: HideFieldsPanelChange) => {
      onViewChange({ ...view, ...change });
    },
    [onViewChange, view],
  );

  const handleHeaderSort = useCallback(
    (fieldKey: string, direction: "asc" | "desc") => {
      const head = view.sort[0];
      if (head && head.fieldKey === fieldKey && head.direction === direction) return;
      onViewChange({
        ...view,
        sort: [{ fieldKey, direction }, ...view.sort.filter((rule) => rule.fieldKey !== fieldKey)],
      });
    },
    [onViewChange, view],
  );
  const handleHeaderFilterBy = useCallback(
    (fieldKey: string) => {
      const fieldDef = fieldDefByKey.get(fieldKey);
      const operator = getFilterOperators(fieldDef)[0]?.operator;
      if (!operator) return;
      if (view.filter.some((rule) => rule.fieldKey === fieldKey)) return;
      onViewChange({ ...view, filter: [...view.filter, { fieldKey, operator }] });
    },
    [fieldDefByKey, onViewChange, view],
  );
  const handleHeaderGroupBy = useCallback(
    (fieldKey: string) => {
      if (view.group.some((rule) => rule.fieldKey === fieldKey)) return;
      onViewChange({
        ...view,
        group: [...view.group, { fieldKey, direction: "asc" }],
      });
    },
    [onViewChange, view],
  );
  const handleHeaderHide = useCallback(
    (fieldKey: string) => {
      if (view.hiddenColumns.includes(fieldKey)) return;
      onViewChange({ ...view, hiddenColumns: [...view.hiddenColumns, fieldKey] });
    },
    [onViewChange, view],
  );

  const [pendingDeleteFieldKey, setPendingDeleteFieldKey] = useState<string | null>(null);
  const pendingDeleteFieldDef = pendingDeleteFieldKey
    ? fieldDefByKey.get(pendingDeleteFieldKey)
    : undefined;
  // Counts only while the dialog is open so an unrelated cell write
  // (which reidentifies `rows`) doesn't drag a per-row scan onto the
  // hot path.
  const pendingDeleteRowCount = useMemo(() => {
    if (pendingDeleteFieldKey === null || !pendingDeleteFieldDef) return 0;
    let count = 0;
    for (const row of rows) {
      const value = getCustomValue(
        row as { custom_values?: Record<string, unknown> | null | undefined },
        pendingDeleteFieldDef,
      );
      if (value !== undefined && value !== null && value !== "") count += 1;
    }
    return count;
  }, [pendingDeleteFieldKey, pendingDeleteFieldDef, rows]);
  const requestDeleteCustomField = useCallback((fieldKey: string) => {
    setPendingDeleteFieldKey(fieldKey);
  }, []);
  const confirmDeleteCustomField = useCallback(async () => {
    if (!pendingDeleteFieldKey || !onDeleteCustomField) {
      setPendingDeleteFieldKey(null);
      return;
    }
    const fieldKey = pendingDeleteFieldKey;
    setPendingDeleteFieldKey(null);
    try {
      await onDeleteCustomField(fieldKey);
    } catch (error) {
      setAnnounce(error instanceof Error ? error.message : "Could not delete field.");
    }
  }, [onDeleteCustomField, pendingDeleteFieldKey]);
  const addFieldEnabled = !readOnly && Boolean(onAddCustomField);
  type CreateFieldModalState = {
    triggerElement: HTMLElement | null;
    insertAfterFieldKey: string | null;
  };
  const [createFieldModal, setCreateFieldModal] = useState<CreateFieldModalState | null>(null);
  const [configModalState, setConfigModalState] = useState<{ fieldKey: string } | null>(null);
  const configModalReturnFocusRef = useRef<HTMLElement | null>(null);
  const tailCellRef = useRef<HTMLTableCellElement | null>(null);
  const [pendingFocusFieldKey, setPendingFocusFieldKey] = useState<string | null>(null);

  const openCreateFieldModal = useCallback(
    (triggerElement: HTMLElement | null, insertAfterFieldKey: string | null) => {
      if (!addFieldEnabled || !triggerElement) return;
      setCreateFieldModal({ triggerElement, insertAfterFieldKey });
    },
    [addFieldEnabled],
  );

  const requestInsertFieldRight = useCallback(
    (fieldKey: string, anchorElement: HTMLElement | null) => {
      if (!addFieldEnabled) return;
      openCreateFieldModal(anchorElement, fieldKey);
    },
    [addFieldEnabled, openCreateFieldModal],
  );
  const requestInsertFieldLeft = useCallback(
    (fieldKey: string, anchorElement: HTMLElement | null) => {
      if (!addFieldEnabled) return;
      // "Insert left of column N" = "insert right of column N-1" — when N
      // is the first visible column, there is no anchor and the consumer
      // collapses that to a null backend `insert_after_field_id`.
      const index = visibleColumnDefs.findIndex((column) => column.fieldKey === fieldKey);
      const previous = index > 0 ? (visibleColumnDefs[index - 1]?.fieldKey ?? null) : null;
      openCreateFieldModal(anchorElement, previous);
    },
    [addFieldEnabled, openCreateFieldModal, visibleColumnDefs],
  );

  const handleAddFieldSubmit = useCallback(
    async (request: AddCustomFieldRequest) => {
      if (!onAddCustomField) return;
      const { newFieldKey } = await onAddCustomField(request);
      setPendingFocusFieldKey(newFieldKey);
    },
    [onAddCustomField],
  );

  // Custom fields open a unified config modal from double-click,
  // chevron, or the header context menu. Core fields and viewer mode
  // pass through unchanged.
  const editConfigEnabled = !readOnly && Boolean(onWrite) && Boolean(onEditCustomFieldBundle);
  const openConfigModal = useCallback(
    (fieldKey: string, triggerEl: HTMLElement | null) => {
      if (!editConfigEnabled) return;
      configModalReturnFocusRef.current = triggerEl;
      setConfigModalState({ fieldKey });
    },
    [editConfigEnabled],
  );

  const handleEditCustomFieldBundle = useCallback(
    async (request: EditCustomFieldBundleRequest) => {
      if (!onEditCustomFieldBundle) return;
      await onEditCustomFieldBundle(request);
    },
    [onEditCustomFieldBundle],
  );

  const requestDuplicateCustomField = useCallback(
    async (fieldKey: string) => {
      if (!onDuplicateCustomField) return;
      try {
        const result = await onDuplicateCustomField(fieldKey);
        if (result?.newFieldKey) setPendingFocusFieldKey(result.newFieldKey);
      } catch (error) {
        setAnnounce(error instanceof Error ? error.message : "Could not duplicate field.");
      }
    },
    [onDuplicateCustomField],
  );

  // Once the consumer's refetch reidentifies fieldDefs and the new column
  // lands in the visible set, jump the selection to row 0 of that column
  // and refocus the grid. Narrow the deps to `selection.setActive` so an
  // unrelated render that reidentifies the `selection` object doesn't
  // re-run this body.
  const setActiveCell = selection.setActive;
  useEffect(() => {
    if (!pendingFocusFieldKey) return;
    const target = visibleColumnDefs.findIndex(
      (column) => column.fieldKey === pendingFocusFieldKey,
    );
    if (target < 0) return;
    const firstRowId = rowIds[0];
    if (firstRowId !== undefined) {
      setActiveCell({ rowId: firstRowId, fieldKey: pendingFocusFieldKey });
    }
    setPendingFocusFieldKey(null);
    wrapperRef.current?.focus({ preventScroll: true });
  }, [pendingFocusFieldKey, visibleColumnDefs, rowIds, setActiveCell]);

  const openAddFieldFromTail = useCallback(() => {
    if (!addFieldEnabled) return;
    const lastVisible = visibleColumnDefs[visibleColumnDefs.length - 1] ?? null;
    openCreateFieldModal(tailCellRef.current, lastVisible?.fieldKey ?? null);
  }, [addFieldEnabled, openCreateFieldModal, visibleColumnDefs]);

  const headerActions = useMemo(
    () => ({
      onSortAsc: (fieldKey: string) => handleHeaderSort(fieldKey, "asc"),
      onSortDesc: (fieldKey: string) => handleHeaderSort(fieldKey, "desc"),
      onFilterBy: handleHeaderFilterBy,
      onGroupBy: handleHeaderGroupBy,
      onHide: handleHeaderHide,
      onDeleteCustomField: onDeleteCustomField ? requestDeleteCustomField : undefined,
      onDuplicateCustomField: onDuplicateCustomField ? requestDuplicateCustomField : undefined,
      onEditCustomFieldConfig: editConfigEnabled ? openConfigModal : undefined,
      onInsertFieldLeft: addFieldEnabled ? requestInsertFieldLeft : undefined,
      onInsertFieldRight: addFieldEnabled ? requestInsertFieldRight : undefined,
    }),
    [
      handleHeaderSort,
      handleHeaderFilterBy,
      handleHeaderGroupBy,
      handleHeaderHide,
      onDeleteCustomField,
      onDuplicateCustomField,
      requestDeleteCustomField,
      requestDuplicateCustomField,
      editConfigEnabled,
      openConfigModal,
      addFieldEnabled,
      requestInsertFieldLeft,
      requestInsertFieldRight,
    ],
  );
  // Plan 08 — header drag-to-reorder. The drag's from / to ids are both
  // visible column ids; splice them inside the full ordered id list
  // (visible + hidden, in display order) so hidden columns keep their
  // relative positions. The result is the new `columnOrder`.
  const handleColumnReorder = useCallback(
    (fromColumnId: string, toColumnId: string) => {
      const fullOrder = orderedColumnsForHidePanel.map((column) => column.id);
      const next = reorderColumnIds(fullOrder, fromColumnId, toColumnId);
      if (next === fullOrder) return;
      onViewChange({ ...view, columnOrder: next });
    },
    [onViewChange, orderedColumnsForHidePanel, view],
  );
  // Plan 08 — DndContext + SortableContext sit outside `<table>` (their
  // accessibility `<div>`s would be invalid HTML nested in `<thead>`).
  // `activationConstraint.distance: 8` defers dnd-kit until the pointer
  // moves 8 px so short clicks still reach the Phase 3 column-select
  // handler (§4.2). The primary (frozen) column stays in the sortable
  // id list so dnd-kit can read its rect, but `useSortable({ disabled })`
  // and the drop-target guard inside `handleColumnDragEnd` prevent it
  // from being dragged or dropped onto.
  const sortableSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const sortableColumnIds = useMemo(
    () => visibleColumnDefs.map((column) => column.id),
    [visibleColumnDefs],
  );
  const primaryColumnId = visibleColumnDefs[0]?.id ?? null;
  const handleColumnDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;
      const fromId = String(active.id);
      const toId = String(over.id);
      if (fromId === toId) return;
      if (fromId === primaryColumnId || toId === primaryColumnId) return;
      handleColumnReorder(fromId, toId);
    },
    [handleColumnReorder, primaryColumnId],
  );
  // Plan 08 §4.3 — accessible keyboard reorder. Operates on the same
  // `view.columnOrder` field as the pointer drag, so the two surfaces
  // (and the Hide-fields panel) agree on the canonical order.
  const fullOrderedColumnIds = useMemo(
    () => orderedColumnsForHidePanel.map((column) => column.id),
    [orderedColumnsForHidePanel],
  );
  const handleColumnOrderChange = useCallback(
    (next: string[]) => {
      onViewChange({ ...view, columnOrder: next });
    },
    [onViewChange, view],
  );
  const columnDragKeyboard = useGridColumnDragKeyboard({
    visibleColumns: visibleColumnDefs,
    fullOrderedColumnIds,
    onColumnOrderChange: handleColumnOrderChange,
    onAnnounce: setAnnounce,
  });
  const columnResize = useGridColumnResize({
    view,
    onViewChange,
    visibleColumnDefs,
    fieldDefByKey,
    wrapperRef,
    visibleRows: visibleDataRows,
  });
  // Reset clears every view-state key the toolbar can mutate. Column
  // order / widths / hidden columns are owned by a future column-
  // config phase and stay untouched.
  const handleResetView = useCallback(() => {
    if (onResetView) {
      onResetView();
      return;
    }
    onViewChange({
      ...view,
      filter: [],
      sort: [],
      group: [],
      aggregations: {},
      expandedGroups: {},
    });
  }, [onResetView, onViewChange, view]);

  // Filter membership requires the rule to be contributing (dormant
  // rules don't tint, matching AirTable). Sort and group count as
  // soon as a rule exists.
  const axisRolesByFieldKey = useMemo<Map<string, AxisRoleSubset>>(() => {
    const map = new Map<string, AxisRoleSubset>();
    const filterContributing = new Set(
      view.filter.filter((rule) => isFilterContributing(rule)).map((rule) => rule.fieldKey),
    );
    const sortKeys = new Set(view.sort.map((rule) => rule.fieldKey));
    const groupKeys = new Set(view.group.map((rule) => rule.fieldKey));
    for (const fieldKey of new Set<string>([...filterContributing, ...sortKeys, ...groupKeys])) {
      const code = buildSubsetCode({
        filter: filterContributing.has(fieldKey),
        sort: sortKeys.has(fieldKey),
        group: groupKeys.has(fieldKey),
      });
      if (code) map.set(fieldKey, code);
    }
    return map;
  }, [view.filter, view.sort, view.group]);

  const handleCommitAndMove = (rowIndex: number, columnIndex: number, shiftKey: boolean) => {
    const next = moveTabCell(
      { rowIndex, columnIndex },
      shiftKey,
      visibleDataRows.length,
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

  const existingFieldLabels = useMemo(
    () =>
      fieldDefs.map((fieldDef) => ({
        fieldKey: fieldDef.field_key,
        displayName: fieldDef.display_name,
      })),
    [fieldDefs],
  );

  const configModalFieldDef = useMemo(() => {
    if (!configModalState) return undefined;
    return fieldDefByKey.get(configModalState.fieldKey);
  }, [configModalState, fieldDefByKey]);
  // Pre-mapped row data for the change-type preflight. Gated on modal
  // open so unrelated cell writes don't drag the per-row map onto the
  // hot path.
  const configModalPreflightRows = useMemo(() => {
    if (!configModalState) return undefined;
    const column = columnDefs.find((entry) => entry.fieldKey === configModalState.fieldKey);
    if (!column) return undefined;
    return rows.map((row) => ({
      rowId: getRowId(row),
      rawValue: column.accessor(row),
    }));
  }, [configModalState, columnDefs, rows, getRowId]);

  const configModalFormulaPreviewRow = useMemo<{
    id: string;
    values: Record<string, unknown>;
  } | null>(() => {
    if (!configModalState || !getFormulaRowValues) return null;
    const fieldDef = fieldDefByKey.get(configModalState.fieldKey);
    if (fieldDef?.custom_field_type !== "formula") return null;
    const row = visibleDataRows[selection.activeCell.rowIndex] ?? visibleDataRows[0];
    if (!row) return null;
    return { id: getRowId(row), values: getFormulaRowValues(row) };
  }, [
    configModalState,
    fieldDefByKey,
    getFormulaRowValues,
    getRowId,
    selection.activeCell.rowIndex,
    visibleDataRows,
  ]);
  const configModalFormulaPreview = useMemo(
    () => ({
      fieldRegistry: formulaFieldRegistry ?? EMPTY_FORMULA_FIELD_REGISTRY,
      row: configModalFormulaPreviewRow,
      rowsRevision: rows,
    }),
    [configModalFormulaPreviewRow, formulaFieldRegistry, rows],
  );

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
    <DataTableErrorBoundary>
      <div className={`data-table-shell data-table-shell-${density}`}>
        <GridToolbar
          readOnly={readOnly}
          view={view}
          fieldDefByKey={fieldDefByKey}
          filterableFieldDefs={filterableFieldDefs}
          sortableFieldDefs={sortableFieldDefs}
          groupableFieldDefs={groupableFieldDefs}
          orderedColumnsForHidePanel={orderedColumnsForHidePanel}
          onFilterChange={handleFilterChange}
          onSortChange={handleSortChange}
          onGroupChange={handleGroupChange}
          onCollapseAllGroups={handleCollapseAllGroups}
          onExpandAllGroups={handleExpandAllGroups}
          onResetView={handleResetView}
          onHideFieldsChange={handleHideFieldsChange}
          overflowMenuActions={overflowMenuActions}
          actions={toolbarActions}
        />
        <ConfirmDestructiveDialog
          open={deleteDialogOpen}
          title={rowSelection.count === 1 ? "Delete 1 row?" : `Delete ${rowSelection.count} rows?`}
          description="This cannot be undone from a saved version. You can ⌘Z to restore within this session."
          confirmLabel="Delete"
          onCancel={() => {
            setDeleteDialogOpen(false);
            focusGrid();
          }}
          onConfirm={() => {
            setDeleteDialogOpen(false);
            void deleteSelectedRows().then(() => focusGrid());
          }}
        />
        {addFieldEnabled ? (
          <CreateFieldConfigModal
            open={createFieldModal !== null}
            onOpenChange={(next) => {
              if (!next) {
                setCreateFieldModal(null);
              }
            }}
            insertAfterFieldKey={createFieldModal?.insertAfterFieldKey ?? null}
            existingFieldLabels={existingFieldLabels}
            dispatchAddField={handleAddFieldSubmit}
            returnFocusTo={createFieldModal?.triggerElement ?? null}
            formulaFieldRegistry={formulaFieldRegistry}
          />
        ) : null}
        {onEditCustomFieldBundle ? (
          <FieldConfigModal
            open={configModalState !== null}
            onOpenChange={(next) => {
              if (!next) {
                setConfigModalState(null);
                // Defer grid refocus; the modal's onCloseAutoFocus
                // already returns focus to the originating header cell.
              }
            }}
            fieldDef={configModalFieldDef}
            existingFieldLabels={existingFieldLabels}
            dispatchBundle={handleEditCustomFieldBundle}
            returnFocusTo={configModalReturnFocusRef.current}
            onFieldRemoved={(message) => {
              setAnnounce(message);
            }}
            sourceCustomFieldType={configModalFieldDef?.custom_field_type}
            preflightRows={configModalPreflightRows}
            optionRows={configModalPreflightRows}
            formulaPreview={configModalFormulaPreview}
          />
        ) : null}
        <ConfirmDestructiveDialog
          open={pendingDeleteFieldKey !== null}
          title={`Delete field “${pendingDeleteFieldDef?.display_name ?? ""}”?`}
          description={`${describeDeleteImpact(pendingDeleteRowCount)} Older locked versions keep this field. This cannot be undone from a saved version.`}
          confirmLabel="Delete field"
          onCancel={() => {
            setPendingDeleteFieldKey(null);
            focusGrid();
          }}
          onConfirm={() => {
            void confirmDeleteCustomField().then(() => focusGrid());
          }}
        />
        <div className="sr-only" aria-live="polite">
          {announce}
        </div>
        <DndContext
          sensors={sortableSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleColumnDragEnd}
        >
          <SortableContext items={sortableColumnIds} strategy={horizontalListSortingStrategy}>
            <div
              ref={wrapperRef}
              className="data-table-wrap"
              role="grid"
              aria-rowcount={bodyPlan.length + 1}
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
                  {visibleColumnDefs.map((column) => {
                    const width = resolveColumnWidth(
                      column,
                      fieldDefByKey.get(column.fieldKey),
                      view,
                    );
                    return <col key={column.id} style={{ width: `${width}px` }} />;
                  })}
                  <col className="data-table-tail-col" />
                </colgroup>
                <GridHeader
                  table={table}
                  visibleColumnDefs={visibleColumnDefs}
                  fieldDefByKey={fieldDefByKey}
                  axisRolesByFieldKey={axisRolesByFieldKey}
                  onColumnMouseDown={pointerDrag.onColumnMouseDown}
                  readOnly={readOnly}
                  hasWriteHandler={Boolean(onWrite)}
                  headerCellRefByFieldKey={headerCellRefByFieldKey}
                  columnDragKeyboard={columnDragKeyboard}
                  columnResize={columnResize}
                  headerActions={headerActions}
                  onAddFieldFromTail={addFieldEnabled ? openAddFieldFromTail : undefined}
                  tailCellRef={tailCellRef}
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
                  bodyPlan={bodyPlan}
                  onGroupToggle={handleToggleGroup}
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
                  onRowExpand={onRowOpen}
                  onCommitAndMove={handleCommitAndMove}
                  fillSource={fill.source}
                  fillTargetPreview={fill.targetPreview}
                  fillHandleVisible={fill.handleVisible}
                  onFillHandleMouseDown={fill.onHandleMouseDown}
                  cellsWritable={!readOnly && Boolean(onWrite)}
                  identifierColumnId={pinnedColumnId}
                  identifierDuplicates={identifierDuplicates}
                />
                <SummaryBar
                  columns={visibleColumnDefs}
                  visibleRows={filteredRows}
                  aggregations={view.aggregations}
                  fieldDefByKey={fieldDefByKey}
                  readOnly={readOnly}
                  onAggregationChange={handleAggregationChange}
                />
              </table>
              {footerAction ? <div className="data-table-footer-row">{footerAction}</div> : null}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </DataTableErrorBoundary>
  );
}

function describeDeleteImpact(populatedRowCount: number): string {
  if (populatedRowCount === 0) return "No rows currently have a value for this field.";
  if (populatedRowCount === 1)
    return "1 row currently has a value for this field; that value will be cleared.";
  return `${populatedRowCount} rows currently have values for this field; those values will be cleared.`;
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
