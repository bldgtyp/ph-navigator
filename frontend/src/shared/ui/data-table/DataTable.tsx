// @size-exception: docs/code-reviews/2026-05-25/frontend-code-review.md#21-srp--file-length-violations
// DataTable.css is loaded globally via the App.css @import manifest (shared/ui
// stylesheets are @import'd once there; see src/styles/README.md).
import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
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
import { useContext } from "react";
import { UnitPreferenceContext } from "../../../lib/units/preference-context";
import { computeIdentifierDuplicates, identifierColumnId } from "./lib/identifier/recordId";
import { applyFilters } from "./lib/filter/apply";
import {
  buildBodyPlan,
  expandedGroupsRevealing,
  groupPathByRowIdFromBodyPlan,
  resolveGroupRules,
} from "./lib/body/plan";
import { isPointerInActiveEditor as isPointerInActiveEditorBase } from "./lib/eventTargets";
import { computeAggregatesByPath } from "./lib/body/aggregates";
import { pruneExpandedGroups } from "./lib/body/prune";
import { effectiveSortFromView } from "./lib/view/sanitize";
import { extractRowDefaults, fieldAllowsNull, planEmptyRows } from "./lib/rows/defaults";
import { formatDisplayCellValue } from "./lib/rows/format";
import { sortRows } from "./lib/sort/sortRows";
import { resolveColumnWidth } from "./lib/columnWidths";
import { buildSubsetCode } from "./tokens/data-table-tints";
import { generatedId } from "../../lib/ids";
import { stableEmptyArray } from "../../lib/stableEmpty";
import { downloadBlob } from "../../lib/downloadBlob";
import { CSV_MIME_TYPE, tableToCsv } from "./lib/export/csv";
import { JSON_MIME_TYPE, tableToJson } from "./lib/export/json";
import { useGridHistory } from "./hooks/useGridHistory";
import { CLEAR_DATA_TABLE_HISTORY_EVENT } from "./historyEvents";
import { useGridWriteReducer } from "./hooks/useGridWriteReducer";
import { useGridSelection } from "./hooks/useGridSelection";
import { useGridRowSelection } from "./hooks/useGridRowSelection";
import { useGridEdit } from "./hooks/useGridEdit";
import { getFieldEditor } from "./fields/registry";
import type { AggregationKind } from "./fields/aggregations";
import { getFilterOperators, isFilterContributing } from "./fields/filterOperators";
import { useGridKeyboard } from "./hooks/useGridKeyboard";
import { useGridPointerDrag } from "./hooks/useGridPointerDrag";
import { useGridClipboard, type CopiedCellRange } from "./hooks/useGridClipboard";
import { useGridFill } from "./hooks/useGridFill";
import { useRowFocusHighlight } from "./hooks/useRowFocusHighlight";
import { reorderColumnIds, useGridColumns } from "./hooks/useGridColumns";
import { useGridColumnDragKeyboard } from "./hooks/useGridColumnDragKeyboard";
import { useGridColumnResize } from "./hooks/useGridColumnResize";
import { DataTableErrorBoundary } from "./components/DataTableErrorBoundary";
import { GridHeader } from "./components/GridHeader";
import { GridBody } from "./components/GridBody";
import { RowContextMenu, type RowContextMenuOpenState } from "./components/RowContextMenu";
import {
  GroupHeaderContextMenu,
  type GroupHeaderContextMenuOpenState,
} from "./components/GroupHeaderContextMenu";
import { SummaryBar } from "./components/SummaryBar";
import { GridToolbar } from "./components/GridToolbar";
import type { HideFieldsPanelChange } from "./components/HideFieldsPanel";
import { CreateFieldConfigModal } from "./components/CreateFieldConfigModal";
import { ConfirmDestructiveDialog } from "./components/ConfirmDestructiveDialog";
import { FieldConfigModal } from "./components/FieldConfigModal";
import { RecordDetailModal } from "./components/RecordDetailModal";
import { ModalDialog } from "../ModalDialog";
import type { FieldRegistryEntry } from "./lib/formula";
import { mapToFormulaType } from "./lib/formula/mapToFormulaType";
import { getCustomValue } from "./lib/customFieldAccessor";
import { normalizeRange } from "./lib/range/normalize";
import { cellKey } from "./lib/cellKey";
import type {
  AddCustomFieldRequest,
  AxisRoleSubset,
  CellCommitMove,
  CellCoord,
  CellRange,
  CellWrite,
  DataTableColumnDef,
  DataTableProps,
  EditCustomFieldBundleRequest,
  FieldDef,
  FilterCondition,
  GroupRule,
  RowAction,
  RowDeletePayload,
  SortRule,
  WriteOp,
} from "./types";
// Identity-stable empty arrays for memo deps. Inline `[]` literals would
// invalidate `useGridColumns`'s memo every render. Shared sentinel lives
// in `shared/lib/stableEmpty`.
const EMPTY_ID_LIST = stableEmptyArray<string>() as string[];
const DATA_TABLE_DATA_ROW_ESTIMATE = 38;
const DATA_TABLE_GROUP_ROW_ESTIMATE = 40;
const PASTE_FLASH_MS = 650;
type PasteOverflowPrompt = {
  rowsOverflow: number;
  resolve: (decision: "add-rows" | "truncate" | "cancel") => void;
};

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
  focusRowId,
  readOnly = false,
  canDownloadCsv = true,
  density = "compact",
  emptyMessage,
  tableName,
  onRowOpen,
  overflowMenuActions,
  bulkSelectionActions,
  footerAction,
  onResetView,
  onDeleteCustomField,
  onAddCustomField,
  onDuplicateCustomField,
  onEditCustomFieldBundle,
  canEditFieldConfig,
  rowActions,
  formulaFieldRegistry,
  getFormulaRowValues,
  linkedRecordOps,
  linkedRecordTargets,
}: DataTableProps<TRow>) {
  const columnDefs = inputColumnDefs;
  const fieldDefs = inputFieldDefs;
  // Active unit preference. Read via context directly (not the
  // `useUnitPreference` hook) so the table can render without a
  // surrounding provider — tests and pure-data hosts get a safe "SI"
  // default. Toggling the real provider cycles a render through every
  // memo that includes it (cell render, aggregates, filter, clipboard)
  // so unit-aware columns re-display without a write.
  const unitPreference = useContext(UnitPreferenceContext);
  const unitSystem = unitPreference?.unitSystem ?? "SI";
  const pinnedColumnId = useMemo(() => identifierColumnId(columnDefs), [columnDefs]);
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
        applyFilters(rows, visibleColumnDefs, fieldDefs, view.filter, unitSystem),
        visibleColumnDefs,
        fieldDefs,
        effectiveSort,
        linkedRecordOps,
      ),
    [rows, visibleColumnDefs, fieldDefs, view.filter, effectiveSort, unitSystem, linkedRecordOps],
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
      computeAggregatesByPath(
        filteredRows,
        visibleColumnDefs,
        fieldDefs,
        { group: view.group, aggregations: view.aggregations },
        undefined,
        unitSystem,
      ),
    [filteredRows, visibleColumnDefs, fieldDefs, view.group, view.aggregations, unitSystem],
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
  // For row virtualization: map each data-row index (0..rowIds.length-1)
  // to its position in `bodyPlan`. Group-header items are skipped. This
  // lets the active-cell scroll-into-view effect translate the
  // selection's row index into a virtualizer index.
  const bodyPlanIndexByDataRowIndex = useMemo(() => {
    const result: number[] = [];
    for (let i = 0; i < bodyPlan.length; i += 1) {
      if (bodyPlan[i]?.kind === "data") result.push(i);
    }
    return result;
  }, [bodyPlan]);
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
  const rendererAliasFieldKeys = useMemo(
    () =>
      new Set(
        columnDefs
          .filter((column) => column.schemaFieldKey && column.schemaFieldKey !== column.fieldKey)
          .map((column) => column.fieldKey),
      ),
    [columnDefs],
  );
  const defaultFormulaFieldRegistry = useMemo(
    () =>
      buildDefaultFormulaFieldRegistry(
        fieldDefs.filter((fieldDef) => !rendererAliasFieldKeys.has(fieldDef.field_key)),
      ),
    [fieldDefs, rendererAliasFieldKeys],
  );
  const effectiveFormulaFieldRegistry = formulaFieldRegistry ?? defaultFormulaFieldRegistry;
  const formulaPreviewColumnByFieldId = useMemo(() => {
    const byFieldId = new Map<string, DataTableColumnDef<TRow>>();
    for (const column of columnDefs) {
      byFieldId.set(column.schemaFieldKey ?? column.fieldKey, column);
    }
    return byFieldId;
  }, [columnDefs]);
  const effectiveGetFormulaRowValues = useCallback(
    (row: TRow) =>
      getFormulaRowValues?.(row) ??
      buildDefaultFormulaRowValues(
        row,
        effectiveFormulaFieldRegistry,
        formulaPreviewColumnByFieldId,
      ),
    [effectiveFormulaFieldRegistry, formulaPreviewColumnByFieldId, getFormulaRowValues],
  );

  const [announce, setAnnounce] = useState("");
  const headerCellRefByFieldKey = useRef(new Map<string, HTMLTableCellElement>()).current;
  const history = useGridHistory();
  const { dispatchWrite, undoOnce, redoOnce } = useGridWriteReducer({
    history,
    onWrite,
    onAnnounce: setAnnounce,
  });
  // Row-expand is an intrinsic, always-on capability. `openRow` is the
  // single handler behind all three affordances (gutter button, context
  // menu, keyboard): it defers to the consumer's `onRowOpen` when given,
  // otherwise opens the built-in record-detail modal. There is no path
  // that leaves expand unwired — a table can never ship a dead button.
  const [recordDetailRowId, setRecordDetailRowId] = useState<string | null>(null);
  const openRow = useCallback(
    (row: TRow) => {
      if (onRowOpen) {
        onRowOpen(row);
        return;
      }
      setRecordDetailRowId(getRowId(row));
    },
    [onRowOpen, getRowId],
  );
  // Whether an IMPLICIT keyboard / double-click gesture on a non-editable
  // cell should fall through to row-open. The explicit gutter Expand
  // button and "Expand record" menu item are always available regardless;
  // this gate only governs the implicit paths, which stay inert in pure
  // viewer mode (readOnly with no consumer drawer) since there is nothing
  // to edit and Enter would otherwise open a modal the user never asked
  // for. Single source of truth so the two call sites cannot drift.
  const canOpenRow = Boolean(onRowOpen) || !readOnly;
  // Modal saves ride the same write chokepoint inline edits use, so a
  // record-detail edit lands on the undo/redo history like any cell edit.
  const commitRecordDetail = useCallback(
    async (writes: CellWrite[], inverses: CellWrite[]) => {
      await dispatchWrite({ kind: "cell", writes }, { kind: "cell", writes: inverses });
    },
    [dispatchWrite],
  );
  // Resolve the open record by id (not by snapshot) so the modal tracks
  // live row data and auto-closes if the row is deleted out from under it.
  const recordDetailRow =
    recordDetailRowId !== null
      ? (visibleDataRows.find((row) => getRowId(row) === recordDetailRowId) ?? null)
      : null;
  const selection = useGridSelection({ rowIds, fieldKeys });
  const rowSelection = useGridRowSelection({ rowIds });
  const [copiedRange, setCopiedRange] = useState<CopiedCellRange | null>(null);
  const [pasteFlashCells, setPasteFlashCells] = useState<ReadonlySet<string>>(() => new Set());
  const pasteFlashTimerRef = useRef<number | null>(null);
  const edit = useGridEdit({
    fieldDefByKey,
    dispatchWrite,
    onAnnounce: setAnnounce,
    hasWriteHandler: Boolean(onWrite),
    unitSystem,
  });

  useEffect(
    () => () => {
      if (pasteFlashTimerRef.current !== null) {
        window.clearTimeout(pasteFlashTimerRef.current);
      }
    },
    [],
  );
  const copiedRowsMountedRef = useRef(false);
  useEffect(() => {
    if (!copiedRowsMountedRef.current) {
      copiedRowsMountedRef.current = true;
      return;
    }
    setCopiedRange(null);
  }, [rows]);

  const copiedVisualRange = useMemo(() => {
    if (!copiedRange) return null;
    const visibleRange = stableRangeToVisibleRange(copiedRange, rowIds, fieldKeys);
    return visibleRange ? normalizeRange(visibleRange) : null;
  }, [copiedRange, fieldKeys, rowIds]);

  const handlePasteComplete = useCallback((writes: CellWrite[]) => {
    setCopiedRange(null);
    if (pasteFlashTimerRef.current !== null) {
      window.clearTimeout(pasteFlashTimerRef.current);
    }
    setPasteFlashCells(new Set(writes.map((write) => cellKey(write.rowId, write.fieldKey))));
    pasteFlashTimerRef.current = window.setTimeout(() => {
      setPasteFlashCells(new Set());
      pasteFlashTimerRef.current = null;
    }, PASTE_FLASH_MS);
  }, []);

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

  const clearHistory = history.clear;
  useEffect(() => {
    if (!sessionKey) return;
    const clearHistoryForDraft = (event: Event) => {
      const scope = (event as CustomEvent<{ projectId: string; versionId: string }>).detail;
      const segments = sessionKey.split(":");
      if (segments.includes(scope.projectId) && segments.includes(scope.versionId)) {
        clearHistory();
      }
    };
    window.addEventListener(CLEAR_DATA_TABLE_HISTORY_EVENT, clearHistoryForDraft);
    return () => window.removeEventListener(CLEAR_DATA_TABLE_HISTORY_EVENT, clearHistoryForDraft);
  }, [clearHistory, sessionKey]);

  // Sanitize filters when a field's numberUnits config changes. Stored
  // filter values are typed in the active unit system at the time of
  // entry — once the unit pair or precision swaps, those values would
  // be ambiguous, so we drop them and surface a no-op announce.
  const lastUnitsByFieldRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const previous = lastUnitsByFieldRef.current;
    const next = new Map<string, string>();
    const changed: string[] = [];
    for (const fieldDef of fieldDefs) {
      if (fieldDef.field_type !== "number") continue;
      const fingerprint = fieldDef.numberUnits ? JSON.stringify(fieldDef.numberUnits) : "";
      next.set(fieldDef.field_key, fingerprint);
      const prev = previous.get(fieldDef.field_key);
      if (prev !== undefined && prev !== fingerprint) changed.push(fieldDef.field_key);
    }
    lastUnitsByFieldRef.current = next;
    if (changed.length === 0) return;
    const changedSet = new Set(changed);
    const remaining = view.filter.filter((rule) => !changedSet.has(rule.fieldKey));
    if (remaining.length !== view.filter.length) {
      onViewChange({ ...view, filter: remaining });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldDefs]);

  const tanstackColumns = useMemo<ColumnDef<TRow>[]>(
    () =>
      visibleColumnDefs.map((column) => {
        const fieldDef = fieldDefByKey.get(column.fieldKey);
        // Number+units fields short-circuit any consumer `render` —
        // those cells must always show the bare value in the active
        // unit system so the toggle re-renders without consumers
        // having to wire their own unit-aware render.
        const isUnitNumber = fieldDef?.field_type === "number" && Boolean(fieldDef.numberUnits);
        return {
          id: column.id,
          header: column.header,
          accessorFn: column.accessor,
          cell: ({ row }) => {
            if (isUnitNumber) {
              return formatDisplayCellValue(column.accessor(row.original), fieldDef, unitSystem);
            }
            return (
              column.render?.(row.original, { isActive: false }) ??
              formatDisplayCellValue(column.accessor(row.original), fieldDef, unitSystem)
            );
          },
        };
      }),
    [fieldDefByKey, visibleColumnDefs, unitSystem],
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

  const wrapperRef = useRef<HTMLDivElement>(null);

  // Row virtualization. Only rows in (or near) the viewport mount; the
  // body renders top + bottom spacer `<tr>`s so the scrollbar geometry
  // matches a fully-populated table. The estimate is conservative —
  // group rows are slightly taller than data rows — and finalized via
  // `measureElement` on each rendered `<tr>` so dynamic heights settle.
  const rowVirtualizer = useVirtualizer({
    count: bodyPlan.length,
    getScrollElement: () => wrapperRef.current,
    estimateSize: (index) =>
      bodyPlan[index]?.kind === "group"
        ? DATA_TABLE_GROUP_ROW_ESTIMATE
        : DATA_TABLE_DATA_ROW_ESTIMATE,
    overscan: 12,
    getItemKey: (index) => {
      const item = bodyPlan[index];
      if (!item) return index;
      return item.kind === "group" ? `group::${item.pathKey}` : `data::${item.rowId}`;
    },
  });

  // Scroll the active cell's row into view when the selection moves.
  // Without this, keyboard navigation past the rendered overscan band
  // would land on an unmounted row. Skipping this work pre-mount keeps
  // a fresh render from auto-scrolling on first paint.
  const activeDataRowIndex = selection.activeCell.rowIndex;
  useEffect(() => {
    if (activeDataRowIndex < 0) return;
    const planIndex = bodyPlanIndexByDataRowIndex[activeDataRowIndex];
    if (planIndex === undefined) return;
    if (!wrapperRef.current) return;
    rowVirtualizer.scrollToIndex(planIndex, { align: "auto" });
  }, [activeDataRowIndex, bodyPlanIndexByDataRowIndex, rowVirtualizer]);

  // Keep the row containing the open inline editor mounted by pinning
  // the virtualizer's scroll position to it. Without this, scrolling
  // an in-progress edit off-screen would unmount the editor mid-edit.
  const editingRowId = edit.editing?.rowId ?? null;
  useEffect(() => {
    if (!editingRowId) return;
    const dataIndex = rowIds.indexOf(editingRowId);
    if (dataIndex < 0) return;
    const planIndex = bodyPlanIndexByDataRowIndex[dataIndex];
    if (planIndex === undefined) return;
    rowVirtualizer.scrollToIndex(planIndex, { align: "auto" });
  }, [editingRowId, rowIds, bodyPlanIndexByDataRowIndex, rowVirtualizer]);

  // Group rules resolved once per (group, columns, fieldDefs) change and
  // shared by the reveal paths below, instead of each call site rebuilding
  // the accessor maps.
  const resolvedGroupRules = useMemo(
    () =>
      view.group.length > 0 ? resolveGroupRules(view.group, visibleColumnDefs, fieldDefs) : null,
    [view.group, visibleColumnDefs, fieldDefs],
  );
  // Shared "make this group path visible" tail: expand any collapsed
  // ancestor of `path` in one view commit.
  const revealGroupPath = useCallback(
    (path: readonly unknown[]) => {
      const nextExpanded = expandedGroupsRevealing(view.expandedGroups, path);
      if (nextExpanded) onViewChange({ ...view, expandedGroups: nextExpanded });
    },
    [onViewChange, view],
  );

  // A focus target hidden inside a collapsed group can't be scrolled
  // to — expand its ancestors first (once per focusRowId value, so the
  // user can still re-collapse the group afterwards).
  const expandedForFocusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusRowId || expandedForFocusRef.current === focusRowId) return;
    if (!resolvedGroupRules || rowIds.includes(focusRowId)) {
      expandedForFocusRef.current = focusRowId;
      return;
    }
    const row = filteredRows.find((candidate) => getRowId(candidate) === focusRowId);
    if (!row) return;
    expandedForFocusRef.current = focusRowId;
    revealGroupPath(resolvedGroupRules.groupAccessors.map((accessor) => accessor(row)));
  }, [filteredRows, focusRowId, getRowId, resolvedGroupRules, revealGroupPath, rowIds]);

  useEffect(() => {
    if (!focusRowId) return;
    const dataIndex = rowIds.indexOf(focusRowId);
    if (dataIndex < 0) return;
    const planIndex = bodyPlanIndexByDataRowIndex[dataIndex];
    if (planIndex === undefined) return;
    rowVirtualizer.scrollToIndex(planIndex, { align: "center" });
  }, [bodyPlanIndexByDataRowIndex, focusRowId, rowIds, rowVirtualizer]);
  useRowFocusHighlight({
    containerRef: wrapperRef,
    rowId: focusRowId,
    dependencyKey: `${focusRowId ?? "none"}:${rowIds.length}`,
    scrollIntoView: false,
  });

  // Phase 3 §4.9: short-circuit pointer drag when the mousedown source
  // lives inside the active editor (inline <input> or single-select
  // popover). Lets native text-selection inside the editor work
  // without interference from the cell-drag hook. Shared with the
  // GridBody contextmenu hit-test via `lib/eventTargets.ts`.
  const editingActive = Boolean(edit.editing);
  const isPointerInActiveEditor = useCallback(
    (target: EventTarget | null) => isPointerInActiveEditorBase(target, { editingActive }),
    [editingActive],
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
  const [pasteOverflowPrompt, setPasteOverflowPrompt] = useState<PasteOverflowPrompt | null>(null);
  const pasteOverflowResolveRef = useRef<PasteOverflowPrompt["resolve"] | null>(null);
  useEffect(() => {
    return () => {
      pasteOverflowResolveRef.current?.("cancel");
      pasteOverflowResolveRef.current = null;
    };
  }, []);
  const resolvePasteRowsOverflow = useCallback((rowsOverflow: number) => {
    return new Promise<"add-rows" | "truncate" | "cancel">((resolve) => {
      pasteOverflowResolveRef.current?.("cancel");
      pasteOverflowResolveRef.current = resolve;
      setPasteOverflowPrompt({ rowsOverflow, resolve });
    });
  }, []);
  const settlePasteOverflowPrompt = useCallback(
    (decision: "add-rows" | "truncate" | "cancel") => {
      const resolve = pasteOverflowPrompt?.resolve ?? pasteOverflowResolveRef.current;
      resolve?.(decision);
      if (pasteOverflowResolveRef.current === resolve) {
        pasteOverflowResolveRef.current = null;
      }
      setPasteOverflowPrompt(null);
    },
    [pasteOverflowPrompt],
  );

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
    onCopyRange: setCopiedRange,
    onPasteComplete: handlePasteComplete,
    onPasteRowsOverflow: resolvePasteRowsOverflow,
    buildEmptyRow,
    generateRowId,
    unitSystem,
  });

  const canInsertRow = Boolean(buildEmptyRow) && !readOnly && Boolean(onWrite);
  const insertRowBelow = useCallback(
    async (anchorRowId: string | null, commitActiveEditor = true) => {
      if (!canInsertRow || !buildEmptyRow) {
        setAnnounce("Row insert is not enabled for this table.");
        return;
      }
      // Commit any pending edit first; abort if the commit failed
      // (validation blocked the cell write).
      if (commitActiveEditor && edit.editing) {
        const committed = await edit.commit();
        if (!committed) return;
      }
      const anchorRow =
        anchorRowId !== null
          ? (visibleDataRows.find((row) => getRowId(row) === anchorRowId) ?? null)
          : null;
      // Plan 30 D10 — Shift-Enter creates a blank row: field defaults
      // come from `FieldDef.default` / natural zero, never cloned from
      // the anchor row. One amendment: when the view is grouped, the
      // group-rule fields DO inherit the anchor's values, so the new
      // row lands in the group the user is working in instead of
      // falling into the catch-all group at the bottom. The explicit
      // "Duplicate record" gesture still owns full-value cloning.
      let groupInherited: Record<string, unknown> | null = null;
      if (anchorRow !== null && resolvedGroupRules) {
        groupInherited = {};
        view.group.forEach((rule, depth) => {
          groupInherited![rule.fieldKey] = resolvedGroupRules.groupAccessors[depth]!(anchorRow);
        });
      }
      const { rows: plannedRows, inserts } = planEmptyRows({
        count: 1,
        fieldDefs,
        buildEmptyRow,
        generateRowId,
        anchorRow,
        anchorRowId,
        overlayDefaults: groupInherited,
      });
      const newRow = plannedRows[0];
      const insert = inserts[0];
      if (!newRow || !insert) return;
      const tmpId = insert.rowId;
      const fieldDefaults = insert.fieldDefaults;
      const firstEditableFieldKey = pickFirstEditableFieldKey(visibleColumnDefs, fieldDefByKey);

      const op: WriteOp = {
        kind: "rowInsert",
        rows: [insert],
      };
      const inverse: WriteOp = {
        kind: "rowDelete",
        rows: [{ rowId: tmpId, row: newRow, anchorRowId }],
      };
      try {
        const result = await dispatchWrite(op, inverse);
        // Catalog-style consumers persist under a server id; keep every
        // post-insert affordance pointed at the row that actually exists.
        const persistedId = result?.insertedRowIds?.[tmpId] ?? tmpId;
        // The new record becomes the active record: expand any collapsed
        // group on its path, then anchor the selection on it — the
        // active-cell effect scrolls it into the viewport once it lands
        // in the render's rowIds. The path reads `fieldDefaults`, whose
        // group-rule entries are the anchor's accessor values (inherited
        // above), so it matches the refetched row's rendered group.
        if (view.group.length > 0) {
          revealGroupPath(view.group.map((rule) => fieldDefaults[rule.fieldKey] ?? null));
        }
        const activeFieldKey = firstEditableFieldKey ?? visibleColumnDefs[0]?.fieldKey;
        if (activeFieldKey) selection.setActive({ rowId: persistedId, fieldKey: activeFieldKey });
        if (firstEditableFieldKey) {
          const initialValue =
            fieldDefaults[firstEditableFieldKey] ??
            fieldDefByKey.get(firstEditableFieldKey)?.default ??
            "";
          edit.queuePendingEdit({
            rowId: persistedId,
            fieldKey: firstEditableFieldKey,
            initialValue,
          });
        }
        setAnnounce("Row inserted.");
      } catch (error) {
        setAnnounce(error instanceof Error ? error.message : "Row insert failed.");
      }
    },
    [
      buildEmptyRow,
      canInsertRow,
      dispatchWrite,
      edit,
      fieldDefByKey,
      fieldDefs,
      visibleDataRows,
      generateRowId,
      getRowId,
      resolvedGroupRules,
      revealGroupPath,
      selection,
      view.group,
      visibleColumnDefs,
    ],
  );
  const defaultFooterAction = canInsertRow ? (
    <button
      type="button"
      className="data-table-add-row-button"
      aria-label="Add row"
      title="Add row"
      onClick={() => {
        void insertRowBelow(null);
      }}
    >
      +
    </button>
  ) : null;
  const renderedFooterAction = footerAction ?? defaultFooterAction;

  const insertRowBelowActive = useCallback(() => {
    const anchorRow = visibleDataRows[selection.activeCell.rowIndex] ?? null;
    return insertRowBelow(anchorRow ? getRowId(anchorRow) : null);
  }, [insertRowBelow, visibleDataRows, getRowId, selection.activeCell.rowIndex]);

  const duplicateRowById = useCallback(
    async (rowId: string) => {
      if (readOnly || !onWrite) return;
      const sourceRow = visibleDataRows.find((row) => getRowId(row) === rowId);
      if (sourceRow === undefined) return;
      const tmpId = generateRowId?.() ?? `tmp_${generatedId("row")}`;
      const op: WriteOp = {
        kind: "rowDuplicate",
        rows: [{ rowId: tmpId, sourceRowId: rowId, sourceRow, anchorRowId: rowId }],
      };
      const inverse: WriteOp = {
        kind: "rowDelete",
        rows: [{ rowId: tmpId, row: sourceRow, anchorRowId: rowId }],
      };
      try {
        await dispatchWrite(op, inverse);
        setAnnounce("Row duplicated.");
      } catch (error) {
        setAnnounce(error instanceof Error ? error.message : "Row duplicate failed.");
      }
    },
    [readOnly, onWrite, visibleDataRows, getRowId, generateRowId, dispatchWrite],
  );

  const deleteRowById = useCallback(
    async (rowId: string) => {
      if (readOnly || !onWrite) return;
      const index = visibleDataRows.findIndex((row) => getRowId(row) === rowId);
      if (index < 0) return;
      const row = visibleDataRows[index]!;
      const anchorRowId = index > 0 ? (rowIds[index - 1] ?? null) : null;
      const op: WriteOp = {
        kind: "rowDelete",
        rows: [{ rowId, row, anchorRowId }],
      };
      const inverse: WriteOp = {
        kind: "rowInsert",
        rows: [
          {
            rowId,
            anchorRowId,
            fieldDefaults: extractRowDefaults(row, fieldDefs, visibleColumnDefs),
          },
        ],
      };
      try {
        await dispatchWrite(op, inverse);
        setAnnounce("Row deleted.");
      } catch (error) {
        setAnnounce(error instanceof Error ? error.message : "Row delete failed.");
      }
    },
    [
      dispatchWrite,
      fieldDefs,
      getRowId,
      onWrite,
      readOnly,
      rowIds,
      visibleColumnDefs,
      visibleDataRows,
    ],
  );

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
      // Fall through to row-open for non-editable cells (see `canOpenRow`).
      if (canOpenRow) openRow(row);
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

  const clearActiveCell = useCallback(async () => {
    const row = visibleDataRows[selection.activeCell.rowIndex];
    const column = visibleColumnDefs[selection.activeCell.columnIndex];
    if (!row || !column) return;
    const fieldDef = fieldDefByKey.get(column.fieldKey);
    const editorKind = getFieldEditor(fieldDef).kind;
    if (readOnly || !onWrite || editorKind === "none") {
      setAnnounce("This cell is read-only.");
      return;
    }
    if (!fieldAllowsNull(fieldDef)) {
      setAnnounce(`${fieldDef?.display_name ?? "Cell"} requires a value.`);
      return;
    }
    const rowId = getRowId(row);
    const previousValue = column.accessor(row);
    selection.setActive({ rowId, fieldKey: column.fieldKey });
    if (previousValue === null || previousValue === undefined) return;
    try {
      await dispatchWrite(
        { kind: "cell", writes: [{ rowId, fieldKey: column.fieldKey, value: null }] },
        { kind: "cell", writes: [{ rowId, fieldKey: column.fieldKey, value: previousValue }] },
      );
      setAnnounce(`${fieldDef?.display_name ?? "Cell"} cleared.`);
    } catch (error) {
      setAnnounce(error instanceof Error ? error.message : "Cell update failed.");
    }
  }, [
    dispatchWrite,
    fieldDefByKey,
    getRowId,
    onWrite,
    readOnly,
    selection,
    visibleColumnDefs,
    visibleDataRows,
  ]);

  // Replace-mode entry point for type-to-edit. `initialKey` is the typed
  // character ("K", "7", " ").
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
    // matches" because option labels are stored trimmed.
    if (editorKind === "single_select") {
      const trimmed = initialKey.trim();
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
    onCopy: clipboard.copy,
    onUndo: () =>
      void undoOnce().catch((error) => {
        setAnnounce(error instanceof Error ? error.message : "Undo failed.");
      }),
    onRedo: () =>
      void redoOnce().catch((error) => {
        setAnnounce(error instanceof Error ? error.message : "Redo failed.");
      }),
    onRowOpen: canOpenRow
      ? () => {
          const row = visibleDataRows[selection.activeCell.rowIndex];
          if (row) openRow(row);
        }
      : undefined,
    onBeginEdit: beginEditActiveCell,
    onPrintableKey: !readOnly && onWrite ? typeToEditActiveCell : undefined,
    onClearActiveCell: !readOnly && onWrite ? clearActiveCell : undefined,
    onRowInsertBelowActive: canInsertRow ? insertRowBelowActive : undefined,
    onFillDown: !readOnly && Boolean(onWrite) ? fill.fillDown : undefined,
    onFillRight: !readOnly && Boolean(onWrite) ? fill.fillRight : undefined,
    onFillUp: !readOnly && Boolean(onWrite) ? fill.fillUp : undefined,
    onFillLeft: !readOnly && Boolean(onWrite) ? fill.fillLeft : undefined,
    onClearCopiedRange: () => setCopiedRange(null),
    hasCopiedRange: copiedRange !== null,
    drag: { isDragging: pointerDrag.isDragging, cancel: pointerDrag.cancel },
  });

  // Row context menu — single shared menu instance opened imperatively
  // by GridBody (right-click) or GridGutter (Shift+F10 / ContextMenu).
  // Open state is frozen at gesture time per PRD §5 render-perf
  // contract; the menu does not re-read selection/row state while
  // open.
  const [rowMenu, setRowMenu] = useState<RowContextMenuOpenState | null>(null);
  const [groupHeaderMenu, setGroupHeaderMenu] = useState<GroupHeaderContextMenuOpenState | null>(
    null,
  );
  const openRowMenu = useCallback(
    (args: {
      rowId: string;
      rowNumber: number;
      x: number;
      y: number;
      returnFocus: HTMLElement | null;
    }) => {
      if (readOnly || !onWrite) return;
      // PRD §5 collapse rules. Snapshot the row-selection summary at
      // right-click time and freeze it into the menu's open state.
      // Rule 1 (count >= 2 && in selection): collapse to one-item
      // `Delete N records`. Rule 2 (count >= 2 && not in selection):
      // clear the selection — D-5b accepts irreversibility — and open
      // the full single-row menu with the post-clear snapshot. Rule 3
      // (count <= 1): open the full menu, selection untouched.
      const count = rowSelection.count;
      const inSelection = rowSelection.isSelected(args.rowId);
      // Rule-2 fallthrough: clear the prior checkbox selection so the
      // menu opens against the right-clicked row in single-row mode.
      const clearsSelection = count >= 2 && !inSelection;
      if (clearsSelection) rowSelection.clear();
      const selectionCount = clearsSelection ? 0 : count;
      const rowIsInSelection = clearsSelection ? false : inSelection;
      // Phase 4 — invoke the consumer's `rowActions` selector at
      // open time so the returned items freeze into the open state
      // (PRD §9). Suppressed in the collapsed branch.
      const collapsed = selectionCount >= 2 && rowIsInSelection;
      let customActions: RowAction[] = [];
      if (!collapsed && rowActions) {
        const row = visibleDataRows.find((r) => getRowId(r) === args.rowId);
        if (row !== undefined) {
          customActions = rowActions({
            rowId: args.rowId,
            row,
            selectionCount,
            rowIsInSelection,
          });
        }
      }
      setRowMenu({
        ...args,
        selectionCount,
        rowIsInSelection,
        customActions,
      });
    },
    [readOnly, onWrite, rowSelection, rowActions, visibleDataRows, getRowId],
  );
  const closeRowMenu = useCallback(() => setRowMenu(null), []);
  const openGroupHeaderMenu = useCallback((args: GroupHeaderContextMenuOpenState) => {
    setGroupHeaderMenu(args);
  }, []);
  const closeGroupHeaderMenu = useCallback(() => setGroupHeaderMenu(null), []);

  // `read_only` does NOT exclude a field — filtering on a computed
  // column is a real use case. attachment is dropped because the
  // registry returns no operators for it.
  const filterableFieldDefs = useMemo(
    () => fieldDefs.filter((fieldDef) => getFilterOperators(fieldDef).length > 0),
    [fieldDefs],
  );
  const sortableFieldDefs = useMemo(
    () => fieldDefs.filter((fieldDef) => fieldDef.field_type !== "attachment"),
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
      canEditFieldConfig,
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
      canEditFieldConfig,
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

  // Download a CSV of exactly what is on screen (WYSIWYG): the
  // filter+sort-resolved `filteredRows` × the ordered, hidden-excluded,
  // identifier-pinned `visibleColumnDefs`, formatted in the active unit
  // system. Pure serialization in `tableToCsv`; this only triggers the
  // browser download. Works read-only and on an empty (header-only) table.
  const handleDownloadCsv = useCallback(() => {
    const { filename, content } = tableToCsv({
      rows: filteredRows,
      columns: visibleColumnDefs,
      fieldDefByKey,
      unitSystem,
      tableName,
    });
    downloadBlob(new Blob([content], { type: CSV_MIME_TYPE }), filename);
  }, [filteredRows, visibleColumnDefs, fieldDefByKey, unitSystem, tableName]);

  const handleDownloadJson = useCallback(() => {
    const { filename, content } = tableToJson({
      rows: filteredRows,
      columns: visibleColumnDefs,
      fieldDefByKey,
      linkedRecordOps,
      tableName,
    });
    downloadBlob(new Blob([content], { type: JSON_MIME_TYPE }), filename);
  }, [filteredRows, visibleColumnDefs, fieldDefByKey, linkedRecordOps, tableName]);

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

  const handleCommitAndMove = (rowIndex: number, columnIndex: number, move: CellCommitMove) => {
    if (move.kind === "insert") {
      void insertRowBelow(rowIds[rowIndex] ?? null, false);
      return;
    }
    const next =
      move.kind === "down"
        ? moveDownCell({ rowIndex, columnIndex }, visibleDataRows.length, visibleColumnDefs.length)
        : moveTabCell(
            { rowIndex, columnIndex },
            move.shiftKey,
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
    // Paste resolves its target against `visibleDataRows` (the same
    // filter/sort/group-resolved subset copy and click-drag fill use), so
    // a view transform never disables it — grouped/filtered/sorted tables
    // paste into the row at the active cell just like an ungrouped one.
    if (readOnly) return;
    if (edit.editing) return;
    const tsv = event.clipboardData.getData("text/plain");
    if (!tsv) return;
    event.preventDefault();
    void clipboard.pasteText(tsv);
  };

  const existingFieldLabels = useMemo(
    () =>
      fieldDefs
        .filter((fieldDef) => !rendererAliasFieldKeys.has(fieldDef.field_key))
        .map((fieldDef) => ({
          fieldKey: fieldDef.field_key,
          displayName: fieldDef.display_name,
        })),
    [fieldDefs, rendererAliasFieldKeys],
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
    const column = columnDefs.find(
      (entry) =>
        entry.fieldKey === configModalState.fieldKey ||
        entry.schemaFieldKey === configModalState.fieldKey,
    );
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
    if (!configModalState) return null;
    const fieldDef = fieldDefByKey.get(configModalState.fieldKey);
    if (fieldDef?.custom_field_type !== "formula") return null;
    const row = visibleDataRows[selection.activeCell.rowIndex] ?? visibleDataRows[0];
    if (!row) return null;
    return { id: getRowId(row), values: effectiveGetFormulaRowValues(row) };
  }, [
    configModalState,
    effectiveGetFormulaRowValues,
    fieldDefByKey,
    getRowId,
    selection.activeCell.rowIndex,
    visibleDataRows,
  ]);
  const configModalFormulaPreview = useMemo(
    () => ({
      fieldRegistry: effectiveFormulaFieldRegistry,
      row: configModalFormulaPreviewRow,
      rowsRevision: rows,
    }),
    [configModalFormulaPreviewRow, effectiveFormulaFieldRegistry, rows],
  );

  const toolbarActions =
    !readOnly && rowSelection.count > 0 ? (
      <>
        <button
          type="button"
          aria-label={`Delete ${rowSelection.count} selected row${rowSelection.count === 1 ? "" : "s"}`}
          onClick={() => setDeleteDialogOpen(true)}
        >
          Delete {rowSelection.count} {rowSelection.count === 1 ? "row" : "rows"}
        </button>
        {bulkSelectionActions?.(rowSelection.selectedRowIds)}
      </>
    ) : null;

  return (
    <DataTableErrorBoundary>
      <div className={`data-table-shell data-table-shell-${density}`}>
        <GridToolbar
          tableName={tableName}
          view={view}
          fieldDefByKey={fieldDefByKey}
          filterableFieldDefs={filterableFieldDefs}
          sortableFieldDefs={sortableFieldDefs}
          groupableFieldDefs={groupableFieldDefs}
          linkedRecordOps={linkedRecordOps}
          orderedColumnsForHidePanel={orderedColumnsForHidePanel}
          onFilterChange={handleFilterChange}
          onSortChange={handleSortChange}
          onGroupChange={handleGroupChange}
          onCollapseAllGroups={handleCollapseAllGroups}
          onExpandAllGroups={handleExpandAllGroups}
          onResetView={handleResetView}
          onDownloadCsv={handleDownloadCsv}
          onDownloadJson={handleDownloadJson}
          canDownloadCsv={canDownloadCsv}
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
            formulaFieldRegistry={effectiveFormulaFieldRegistry}
            linkedRecordTargets={linkedRecordTargets}
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
            linkedRecordTargets={linkedRecordTargets}
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
            <div className="data-table-wrap">
              <div
                ref={wrapperRef}
                className="data-table-scroll"
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
              the sticky frozen cell can overlap the adjacent column. */}
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
                    unitSystem={unitSystem}
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
                    rowVirtualizer={rowVirtualizer}
                    bodyPlanIndexByDataRowIndex={bodyPlanIndexByDataRowIndex}
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
                    onRowExpand={openRow}
                    onCommitAndMove={handleCommitAndMove}
                    fillSource={fill.source}
                    fillTargetPreview={fill.targetPreview}
                    fillHandleVisible={fill.handleVisible}
                    onFillHandleMouseDown={fill.onHandleMouseDown}
                    copiedRange={copiedVisualRange}
                    pasteFlashCells={pasteFlashCells}
                    cellsWritable={!readOnly && Boolean(onWrite)}
                    identifierColumnId={pinnedColumnId}
                    identifierDuplicates={identifierDuplicates}
                    onRowContextMenu={!readOnly && onWrite ? openRowMenu : undefined}
                    onGroupHeaderContextMenu={
                      view.group.length > 0 ? openGroupHeaderMenu : undefined
                    }
                    editingActive={Boolean(edit.editing)}
                    linkedRecordOps={linkedRecordOps}
                  />
                  <SummaryBar
                    columns={visibleColumnDefs}
                    visibleRows={filteredRows}
                    aggregations={view.aggregations}
                    fieldDefByKey={fieldDefByKey}
                    readOnly={readOnly}
                    onAggregationChange={handleAggregationChange}
                    unitSystem={unitSystem}
                  />
                </table>
              </div>
              <div className="data-table-footer-row">
                {renderedFooterAction}
                <span className="data-table-footer-record-count">
                  <span className="data-table-footer-record-count-label">Count</span>
                  <span className="data-table-footer-record-count-value">
                    {filteredRows.length}
                  </span>
                </span>
                <span
                  className="data-table-footer-status"
                  data-mode={readOnly ? "read-only" : "editable"}
                >
                  {readOnly ? "Read-only" : "Editable"}
                </span>
              </div>
            </div>
          </SortableContext>
        </DndContext>
        <RowContextMenu
          open={rowMenu}
          onClose={closeRowMenu}
          onInsertBelow={() => {
            if (rowMenu) void insertRowBelow(rowMenu.rowId);
          }}
          onDuplicate={() => {
            if (rowMenu) void duplicateRowById(rowMenu.rowId);
          }}
          onOpen={() => {
            if (!rowMenu) return;
            const row = visibleDataRows.find((r) => getRowId(r) === rowMenu.rowId);
            if (row) openRow(row);
          }}
          onDelete={() => {
            if (rowMenu) void deleteRowById(rowMenu.rowId);
          }}
          onDeleteSelection={() => {
            void deleteSelectedRows();
          }}
        />
        {recordDetailRow ? (
          <RecordDetailModal
            row={recordDetailRow}
            rowId={getRowId(recordDetailRow)}
            columns={visibleColumnDefs}
            fieldDefByKey={fieldDefByKey}
            readOnly={readOnly || !onWrite}
            unitSystem={unitSystem}
            onCommit={commitRecordDetail}
            onClose={() => setRecordDetailRowId(null)}
          />
        ) : null}
        <GroupHeaderContextMenu
          open={groupHeaderMenu}
          onClose={closeGroupHeaderMenu}
          onCollapseAll={handleCollapseAllGroups}
          onExpandAll={handleExpandAllGroups}
        />
        {pasteOverflowPrompt ? (
          <ModalDialog
            title="This paste is bigger than the table"
            titleId="data-table-paste-overflow-title"
            onClose={() => settlePasteOverflowPrompt("cancel")}
          >
            <div className="modal-body">
              <p>
                The copied data has <strong>{pasteOverflowPrompt.rowsOverflow}</strong> more{" "}
                {pasteOverflowPrompt.rowsOverflow === 1 ? "row" : "rows"} than the table can fit
                from here.
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => settlePasteOverflowPrompt("cancel")}
              >
                Cancel
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => settlePasteOverflowPrompt("truncate")}
              >
                Truncate
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => settlePasteOverflowPrompt("add-rows")}
              >
                Add {pasteOverflowPrompt.rowsOverflow}{" "}
                {pasteOverflowPrompt.rowsOverflow === 1 ? "row" : "rows"}
              </button>
            </div>
          </ModalDialog>
        ) : null}
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

function stableRangeToVisibleRange(
  range: CopiedCellRange,
  rowIds: readonly string[],
  fieldKeys: readonly string[],
): CellRange | null {
  const anchorRowIndex = rowIds.indexOf(range.anchor.rowId);
  const focusRowIndex = rowIds.indexOf(range.focus.rowId);
  const anchorColumnIndex = fieldKeys.indexOf(range.anchor.fieldKey);
  const focusColumnIndex = fieldKeys.indexOf(range.focus.fieldKey);
  if (anchorRowIndex < 0 || focusRowIndex < 0 || anchorColumnIndex < 0 || focusColumnIndex < 0) {
    return null;
  }
  return {
    anchor: { rowIndex: anchorRowIndex, columnIndex: anchorColumnIndex },
    focus: { rowIndex: focusRowIndex, columnIndex: focusColumnIndex },
  };
}

function buildDefaultFormulaFieldRegistry(fieldDefs: readonly FieldDef[]): FieldRegistryEntry[] {
  return fieldDefs.filter(isFormulaReferenceableField).map((fieldDef) => ({
    field_id: fieldDef.field_key,
    display_name: fieldDef.display_name,
    origin: fieldDef.built_in === true ? "core" : "custom",
    field_type: mapToFormulaType(fieldDef.field_type),
  }));
}

function isFormulaReferenceableField(fieldDef: FieldDef): boolean {
  // Read-only projection columns such as inverse/incoming links are not
  // persisted in the table's formula registry. They now carry `built_in`
  // (so their headers show the locked-schema border), so exclude them by
  // their read-only-projection shape rather than by `built_in`: drop any
  // read-only non-custom field that either isn't built-in or is a
  // linked-record projection. Real schema fields (built-in non-links,
  // custom fields) stay referenceable.
  const isReadOnlyProjection =
    fieldDef.read_only &&
    !fieldDef.custom_field_type &&
    (fieldDef.built_in !== true || fieldDef.field_type === "linked_record");
  return !isReadOnlyProjection;
}

function buildDefaultFormulaRowValues<TRow>(
  row: TRow,
  fieldRegistry: ReadonlyArray<FieldRegistryEntry>,
  columnByFieldId: ReadonlyMap<string, DataTableColumnDef<TRow>>,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  const record = row as {
    custom_values?: Record<string, unknown> | null | undefined;
    custom?: Record<string, unknown> | null | undefined;
    [key: string]: unknown;
  };
  for (const entry of fieldRegistry) {
    const column = columnByFieldId.get(entry.field_id);
    const value = column ? column.accessor(row) : getCustomValue(record, entry.field_id);
    values[entry.field_id] = value ?? null;
  }
  return values;
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

function moveDownCell(active: CellCoord, rowCount: number, columnCount: number): CellCoord {
  if (rowCount === 0 || columnCount === 0) return active;
  return {
    rowIndex: Math.min(rowCount - 1, active.rowIndex + 1),
    columnIndex: active.columnIndex,
  };
}
