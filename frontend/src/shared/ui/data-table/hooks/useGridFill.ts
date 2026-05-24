import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  buildFillTargetFromPointer,
  chooseFillAxis,
  clampRangeToGroup,
  planFill,
  splitRangeByGroup,
  type FillAxis,
  type NormalizedRange,
} from "../lib";
import { AXIS_THRESHOLD, EDGE_PX, SCROLL_PX } from "../tokens/pointerDragConstants";
import type {
  CellWrite,
  DataTableColumnDef,
  FieldDef,
  FillState,
  WriteOp,
} from "../types";
import type { GridSelection } from "./useGridSelection";
import type { DispatchWrite } from "./useGridWriteReducer";

// Phase 7 §4.1: orchestrator for the fill handle drag + ⌘D / ⌘R
// keyboard. Sibling to `useGridPointerDrag`, not a co-mode: both hooks
// install their own document-level listeners and never share state. The
// only common surface is the three pointer-drag constants imported from
// `pointerDragConstants.ts`.

export type GridFill = FillState & {
  isDragging: boolean;
  onHandleMouseDown: (event: ReactMouseEvent<HTMLElement>) => void;
  fillDown: () => Promise<void>;
  fillRight: () => Promise<void>;
  cancel: () => void;
};

export type UseGridFillArgs<TRow> = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  selection: GridSelection;
  rows: TRow[];
  rowIds: string[];
  fieldKeys: string[];
  columns: DataTableColumnDef<TRow>[];
  fieldDefs: FieldDef[];
  getRowId: (row: TRow) => string;
  groupPathByRowId: ReadonlyMap<string, string>;
  dispatchWrite: DispatchWrite;
  readOnly: boolean;
  isEditing: boolean;
  hasWriteHandler: boolean;
  onAnnounce: (message: string) => void;
};

export function useGridFill<TRow>(args: UseGridFillArgs<TRow>): GridFill {
  const {
    containerRef,
    selection,
    rows,
    rowIds,
    fieldKeys,
    columns,
    fieldDefs,
    getRowId,
    groupPathByRowId,
    dispatchWrite,
    readOnly,
    isEditing,
    hasWriteHandler,
    onAnnounce,
  } = args;

  // Derived per-render: source is the active selection's normalized
  // rectangle. Empty grid → no source. Out-of-range coords (e.g. just
  // after a row delete) → no source.
  const source: NormalizedRange | null = useMemo(() => {
    if (rows.length === 0 || columns.length === 0) return null;
    const range = selection.normalizedRange;
    if (
      range.rowStart < 0 ||
      range.rowEnd >= rows.length ||
      range.columnStart < 0 ||
      range.columnEnd >= columns.length
    ) {
      return null;
    }
    return range;
  }, [columns.length, rows.length, selection.normalizedRange]);

  // The source rectangle's group, or "" when ungrouped / cross-group.
  // A single empty string means "ungrouped view" (handle visible);
  // null means "rectangle spans multiple groups" (handle hidden).
  const sourceGroup = useMemo<string | null>(() => {
    if (!source) return null;
    let group: string | null = null;
    for (let r = source.rowStart; r <= source.rowEnd; r += 1) {
      const id = rowIds[r];
      if (!id) continue;
      const g = groupPathByRowId.get(id) ?? "";
      if (group === null) {
        group = g;
        continue;
      }
      if (g !== group) return null;
    }
    return group ?? "";
  }, [groupPathByRowId, rowIds, source]);

  const handleVisible =
    !readOnly &&
    !isEditing &&
    hasWriteHandler &&
    rows.length > 0 &&
    source !== null &&
    sourceGroup !== null;

  const [isDragging, setIsDragging] = useState(false);
  const [targetPreview, setTargetPreview] = useState<NormalizedRange | null>(null);

  // Document-listener lifecycle mirrors useGridPointerDrag: attach on
  // mousedown, tear down on mouseup. Refs hold the live source rect and
  // axis state so listeners installed at mousedown time see the latest
  // values without re-binding.
  const sourceRef = useRef<NormalizedRange | null>(null);
  const sourceGroupRef = useRef<string | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const axisRef = useRef<FillAxis | null>(null);
  const targetPreviewRef = useRef<NormalizedRange | null>(null);
  const hasAnnouncedClampRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Keep refs in sync with the freshest dispatch / row / column data so
  // the mouseup commit path uses current values. Mid-drag re-renders
  // (e.g. a parent state change) don't break the in-flight session.
  const liveRef = useRef({
    rows,
    rowIds,
    columns,
    fieldDefs,
    fieldKeys,
    getRowId,
    groupPathByRowId,
    dispatchWrite,
    onAnnounce,
    selection,
  });
  useEffect(() => {
    liveRef.current = {
      rows,
      rowIds,
      columns,
      fieldDefs,
      fieldKeys,
      getRowId,
      groupPathByRowId,
      dispatchWrite,
      onAnnounce,
      selection,
    };
  });

  const stopAutoScroll = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const teardown = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    sourceRef.current = null;
    sourceGroupRef.current = null;
    pointerStartRef.current = null;
    lastPointerRef.current = null;
    axisRef.current = null;
    targetPreviewRef.current = null;
    hasAnnouncedClampRef.current = false;
    stopAutoScroll();
    setIsDragging(false);
    setTargetPreview(null);
    if (typeof document !== "undefined") {
      document.body.removeAttribute("data-grid-fill-active");
    }
  }, [stopAutoScroll]);

  const resolvePointerToCell = useCallback((): { rowIndex: number; columnIndex: number } | null => {
    const pointer = lastPointerRef.current;
    if (!pointer) return null;
    const target = document.elementFromPoint(pointer.x, pointer.y);
    if (!(target instanceof Element)) return null;
    const cellEl = target.closest("td[data-row-id][data-field-key]");
    if (!(cellEl instanceof HTMLElement)) return null;
    const rowId = cellEl.dataset.rowId;
    const fieldKey = cellEl.dataset.fieldKey;
    if (!rowId || !fieldKey) return null;
    const rowIndex = liveRef.current.rowIds.indexOf(rowId);
    const columnIndex = liveRef.current.fieldKeys.indexOf(fieldKey);
    if (rowIndex === -1 || columnIndex === -1) return null;
    return { rowIndex, columnIndex };
  }, []);

  const updatePreview = useCallback(() => {
    const src = sourceRef.current;
    const pointerStart = pointerStartRef.current;
    const pointerCurrent = lastPointerRef.current;
    if (!src || !pointerStart || !pointerCurrent) return;
    if (axisRef.current === null) {
      const axis = chooseFillAxis({
        pointerStart,
        pointerCurrent,
        axisThreshold: AXIS_THRESHOLD,
      });
      if (axis === null) {
        targetPreviewRef.current = null;
        setTargetPreview(null);
        return;
      }
      axisRef.current = axis;
    }
    const axis = axisRef.current;
    const pointerCell = resolvePointerToCell();
    if (!pointerCell) {
      return;
    }
    const rawTarget = buildFillTargetFromPointer({
      source: src,
      pointerCell,
      axis,
      rowCount: liveRef.current.rows.length,
      columnCount: liveRef.current.columns.length,
    });
    const clamp = clampRangeToGroup({
      target: rawTarget,
      source: src,
      groupPathByRowId: liveRef.current.groupPathByRowId,
      rowIds: liveRef.current.rowIds,
      axis,
    });
    if (clamp.wasClamped && !hasAnnouncedClampRef.current) {
      hasAnnouncedClampRef.current = true;
      liveRef.current.onAnnounce("Fill clamped to group bottom.");
    }
    targetPreviewRef.current = clamp.clamped;
    setTargetPreview(clamp.clamped);
  }, [resolvePointerToCell]);

  const autoScrollFrame = useCallback(() => {
    rafIdRef.current = null;
    const container = containerRef.current;
    const pointer = lastPointerRef.current;
    if (!container || !pointer) return;
    const rect = container.getBoundingClientRect();
    let dx = 0;
    let dy = 0;
    if (pointer.y - rect.top < EDGE_PX) dy = -SCROLL_PX;
    else if (rect.bottom - pointer.y < EDGE_PX) dy = SCROLL_PX;
    if (pointer.x - rect.left < EDGE_PX) dx = -SCROLL_PX;
    else if (rect.right - pointer.x < EDGE_PX) dx = SCROLL_PX;
    if (dx === 0 && dy === 0) return;
    container.scrollBy(dx, dy);
    updatePreview();
    rafIdRef.current = requestAnimationFrame(autoScrollFrame);
  }, [containerRef, updatePreview]);

  const ensureAutoScrollRunning = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(autoScrollFrame);
  }, [autoScrollFrame]);

  const commitDrag = useCallback(async () => {
    const src = sourceRef.current;
    const target = targetPreviewRef.current;
    const live = liveRef.current;
    if (!src || !target) return;
    if (
      target.rowStart === src.rowStart &&
      target.rowEnd === src.rowEnd &&
      target.columnStart === src.columnStart &&
      target.columnEnd === src.columnEnd
    ) {
      live.onAnnounce("Fill canceled.");
      return;
    }
    const result = planFill({
      source: src,
      target,
      rows: live.rows,
      columns: live.columns,
      fieldDefs: live.fieldDefs,
      getRowId: live.getRowId,
    });
    if (result.writes.length === 0) {
      live.onAnnounce(
        result.skipped > 0 ? `${result.skipped} cells skipped (read-only).` : "Fill canceled.",
      );
      return;
    }
    const op: WriteOp = { kind: "fill", writes: result.writes };
    const inverse: WriteOp = { kind: "cell", writes: result.inverse };
    try {
      await live.dispatchWrite(op, inverse);
    } catch (error) {
      live.onAnnounce(error instanceof Error ? error.message : "Fill failed.");
      return;
    }
    const skippedNote = result.skipped > 0 ? ` (${result.skipped} skipped, read-only)` : "";
    live.onAnnounce(`${result.writes.length} cells filled.${skippedNote}`);
    // Selection lands on the target rectangle so the user can chain
    // another gesture (§2 constraint 12).
    const topLeftRowId = live.rowIds[src.rowStart];
    const topLeftFieldKey = live.fieldKeys[src.columnStart];
    const bottomRightRowId = live.rowIds[target.rowEnd];
    const bottomRightFieldKey = live.fieldKeys[target.columnEnd];
    if (topLeftRowId && topLeftFieldKey && bottomRightRowId && bottomRightFieldKey) {
      live.selection.setActive({ rowId: topLeftRowId, fieldKey: topLeftFieldKey });
      live.selection.extendTo({ rowId: bottomRightRowId, fieldKey: bottomRightFieldKey });
    }
  }, []);

  const onHandleMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      if (!handleVisible || !source) return;
      event.preventDefault();
      event.stopPropagation();
      sourceRef.current = source;
      sourceGroupRef.current = sourceGroup;
      pointerStartRef.current = { x: event.clientX, y: event.clientY };
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      axisRef.current = null;
      targetPreviewRef.current = null;
      hasAnnouncedClampRef.current = false;
      setIsDragging(true);
      setTargetPreview(null);
      if (typeof document !== "undefined") {
        document.body.setAttribute("data-grid-fill-active", "true");
      }
      containerRef.current?.focus({ preventScroll: true });

      const handleMouseMove = (moveEvent: MouseEvent) => {
        lastPointerRef.current = { x: moveEvent.clientX, y: moveEvent.clientY };
        updatePreview();
        ensureAutoScrollRunning();
      };
      const handleMouseUp = () => {
        void commitDrag().finally(() => {
          teardown();
        });
      };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("pointerup", handleMouseUp, { once: true });
      cleanupRef.current = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.removeEventListener("pointerup", handleMouseUp);
      };
    },
    [
      commitDrag,
      containerRef,
      ensureAutoScrollRunning,
      handleVisible,
      source,
      sourceGroup,
      teardown,
      updatePreview,
    ],
  );

  const cancel = useCallback(() => {
    teardown();
  }, [teardown]);

  // Build a combined fill op from N (source, target) pairs. Used by ⌘D
  // when the selection spans groups: each sub-range fills from its own
  // top row, all under one `kind: "fill"` op so ⌘Z reverts everything
  // in one history step.
  const dispatchCombinedFill = useCallback(
    async (pairs: { source: NormalizedRange; target: NormalizedRange }[]) => {
      const live = liveRef.current;
      const writes: CellWrite[] = [];
      const inverse: CellWrite[] = [];
      let totalSkipped = 0;
      for (const pair of pairs) {
        const result = planFill({
          source: pair.source,
          target: pair.target,
          rows: live.rows,
          columns: live.columns,
          fieldDefs: live.fieldDefs,
          getRowId: live.getRowId,
        });
        writes.push(...result.writes);
        inverse.push(...result.inverse);
        totalSkipped += result.skipped;
      }
      if (writes.length === 0) {
        live.onAnnounce(
          totalSkipped > 0
            ? `${totalSkipped} cells skipped (read-only).`
            : "Nothing to fill.",
        );
        return;
      }
      const op: WriteOp = { kind: "fill", writes };
      const inverseOp: WriteOp = { kind: "cell", writes: inverse };
      try {
        await live.dispatchWrite(op, inverseOp);
      } catch (error) {
        live.onAnnounce(error instanceof Error ? error.message : "Fill failed.");
        return;
      }
      const skippedNote = totalSkipped > 0 ? ` (${totalSkipped} skipped, read-only)` : "";
      live.onAnnounce(`${writes.length} cells filled.${skippedNote}`);
    },
    [],
  );

  const fillDown = useCallback(async () => {
    const live = liveRef.current;
    if (readOnly || isEditing || !hasWriteHandler) return;
    if (live.rows.length === 0) return;
    const range = live.selection.normalizedRange;
    if (range.rowStart === range.rowEnd) {
      live.onAnnounce("Select more than one row to fill down.");
      return;
    }
    const subRanges = splitRangeByGroup({
      range,
      groupPathByRowId: live.groupPathByRowId,
      rowIds: live.rowIds,
    });
    const pairs = subRanges
      .filter((sub) => sub.rowEnd > sub.rowStart)
      .map((sub) => ({
        source: {
          rowStart: sub.rowStart,
          rowEnd: sub.rowStart,
          columnStart: sub.columnStart,
          columnEnd: sub.columnEnd,
        },
        target: sub,
      }));
    if (pairs.length === 0) {
      live.onAnnounce("Select more than one row to fill down.");
      return;
    }
    await dispatchCombinedFill(pairs);
  }, [dispatchCombinedFill, hasWriteHandler, isEditing, readOnly]);

  const fillRight = useCallback(async () => {
    const live = liveRef.current;
    if (readOnly || isEditing || !hasWriteHandler) return;
    if (live.rows.length === 0) return;
    const range = live.selection.normalizedRange;
    if (range.columnStart === range.columnEnd) {
      live.onAnnounce("Select more than one column to fill right.");
      return;
    }
    const pair = {
      source: {
        rowStart: range.rowStart,
        rowEnd: range.rowEnd,
        columnStart: range.columnStart,
        columnEnd: range.columnStart,
      },
      target: range,
    };
    await dispatchCombinedFill([pair]);
  }, [dispatchCombinedFill, hasWriteHandler, isEditing, readOnly]);

  // Mid-edit start aborts any drag-in-progress (§2 constraint 8).
  useEffect(() => {
    if (isEditing && isDragging) {
      teardown();
    }
  }, [isEditing, isDragging, teardown]);

  // Unmount-time safety: tear down any lingering document listeners.
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (typeof document !== "undefined") {
        document.body.removeAttribute("data-grid-fill-active");
      }
    };
  }, []);

  return {
    source: handleVisible ? source : null,
    targetPreview,
    handleVisible,
    isDragging,
    onHandleMouseDown,
    fillDown,
    fillRight,
    cancel,
  };
}
