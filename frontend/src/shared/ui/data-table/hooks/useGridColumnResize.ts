import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  clamp,
  measureColumnFitWidth,
  resolveColumnMax,
  resolveColumnMin,
  resolveColumnWidth,
} from "../lib/columnWidths";
import type { DataTableColumnDef, FieldDef, ViewState } from "../types";

// Pointer-driven column-resize gesture. Uses Pointer Events so mouse /
// touch / pen route through one path. Per-frame width updates emit
// `onViewChange` — the consumer's 500 ms debounce in
// `useProjectTableViewState` collapses the burst into a single PUT.
//
// Sets `data-column-resizing="true"` on the wrapper while a drag is
// active so CSS can override the body cursor + disable text selection.

export type UseGridColumnResizeArgs<TRow> = {
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  visibleColumnDefs: readonly DataTableColumnDef<TRow>[];
  fieldDefByKey: Map<string, FieldDef>;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  // Post-filter / post-group visible rows for fit-to-content
  // measurement. When omitted only the header label is measured.
  visibleRows?: readonly TRow[];
};

export type GridColumnResize = {
  isResizing: boolean;
  activeColumnId: string | null;
  onHandlePointerDown: (columnId: string, event: ReactPointerEvent<HTMLElement>) => void;
  onHandleDoubleClick: (columnId: string) => void;
};

type Session = {
  columnId: string;
  pointerId: number;
  handleEl: HTMLElement;
  startWidth: number;
  startClientX: number;
  minWidth: number;
  maxWidth: number;
  pendingWidth: number | null;
  rafId: number | null;
  // Decoupled from `rafId` so synchronous rAF stubs (used in tests)
  // don't see a stale handle after the callback has already fired and
  // re-skip scheduling on the next pointermove.
  frameScheduled: boolean;
  // Whether the start width came from an explicit persisted entry. Esc
  // cancel uses this to decide whether to delete the key (no prior
  // value, restore the seed) or restore the prior persisted number.
  hadPriorPersistedValue: boolean;
};

export function useGridColumnResize<TRow>(args: UseGridColumnResizeArgs<TRow>): GridColumnResize {
  const { view, onViewChange, visibleColumnDefs, fieldDefByKey, wrapperRef, visibleRows } = args;

  const sessionRef = useRef<Session | null>(null);
  const viewRef = useRef(view);
  const onViewChangeRef = useRef(onViewChange);
  const visibleRowsRef = useRef(visibleRows);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useEffect(() => {
    onViewChangeRef.current = onViewChange;
  }, [onViewChange]);
  useEffect(() => {
    visibleRowsRef.current = visibleRows;
  }, [visibleRows]);

  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);

  const setActive = useCallback(
    (id: string | null) => {
      const wrap = wrapperRef.current;
      if (wrap) {
        if (id) wrap.setAttribute("data-column-resizing", "true");
        else wrap.removeAttribute("data-column-resizing");
      }
      setActiveColumnId(id);
    },
    [wrapperRef],
  );

  const commitWidth = useCallback((columnId: string, nextWidth: number) => {
    const v = viewRef.current;
    if (v.columnWidths[columnId] === nextWidth) return;
    onViewChangeRef.current({
      ...v,
      columnWidths: { ...v.columnWidths, [columnId]: nextWidth },
    });
  }, []);

  const flushPending = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    session.rafId = null;
    session.frameScheduled = false;
    if (session.pendingWidth === null) return;
    const width = session.pendingWidth;
    session.pendingWidth = null;
    commitWidth(session.columnId, width);
  }, [commitWidth]);

  const teardown = useCallback(
    (cancelToStartWidth: boolean) => {
      const session = sessionRef.current;
      if (!session) return;
      if (session.rafId !== null) {
        cancelAnimationFrame(session.rafId);
        session.rafId = null;
      }
      try {
        session.handleEl.releasePointerCapture(session.pointerId);
      } catch {
        // Capture may have already been lost (detached element).
      }
      if (cancelToStartWidth) {
        const v = viewRef.current;
        const next: Record<string, number> = { ...v.columnWidths };
        if (session.hadPriorPersistedValue) {
          next[session.columnId] = session.startWidth;
        } else {
          delete next[session.columnId];
        }
        onViewChangeRef.current({ ...v, columnWidths: next });
      } else if (session.pendingWidth !== null) {
        commitWidth(session.columnId, session.pendingWidth);
      }
      sessionRef.current = null;
      setActive(null);
    },
    [commitWidth, setActive],
  );

  const onHandlePointerDown = useCallback(
    (columnId: string, event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      if (sessionRef.current) return;
      const columnDef = visibleColumnDefs.find((c) => c.id === columnId);
      if (!columnDef || columnDef.resizable === false) return;

      const persisted = viewRef.current.columnWidths[columnId];
      const startWidth = resolveColumnWidth(
        columnDef,
        fieldDefByKey.get(columnDef.fieldKey),
        viewRef.current,
      );
      const handleEl = event.currentTarget as HTMLElement;
      try {
        handleEl.setPointerCapture(event.pointerId);
      } catch {
        // setPointerCapture fails in jsdom; document listeners still drive the session.
      }

      sessionRef.current = {
        columnId,
        pointerId: event.pointerId,
        handleEl,
        startWidth,
        startClientX: event.clientX,
        minWidth: resolveColumnMin(columnDef),
        maxWidth: resolveColumnMax(columnDef),
        pendingWidth: null,
        rafId: null,
        frameScheduled: false,
        hadPriorPersistedValue: persisted !== undefined,
      };
      setActive(columnId);
      event.preventDefault();
      event.stopPropagation();
    },
    [fieldDefByKey, setActive, visibleColumnDefs],
  );

  // Always-on document listeners: cheaper than per-drag attach/detach
  // and avoids races if an ancestor swallows the event with
  // stopPropagation. They short-circuit when there is no active session.
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      const delta = event.clientX - session.startClientX;
      const target = clamp(session.startWidth + delta, session.minWidth, session.maxWidth);
      session.pendingWidth = Math.round(target);
      if (!session.frameScheduled) {
        session.frameScheduled = true;
        session.rafId = requestAnimationFrame(flushPending);
      }
    };
    const handlePointerUp = (event: PointerEvent) => {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      teardown(false);
    };
    const handlePointerCancel = (event: PointerEvent) => {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      teardown(true);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !sessionRef.current) return;
      event.preventDefault();
      teardown(true);
    };
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [flushPending, teardown]);

  useEffect(() => {
    return () => {
      const session = sessionRef.current;
      if (session?.rafId != null) cancelAnimationFrame(session.rafId);
      sessionRef.current = null;
    };
  }, []);

  const onHandleDoubleClick = useCallback(
    (columnId: string) => {
      const columnDef = visibleColumnDefs.find((c) => c.id === columnId);
      if (!columnDef || columnDef.resizable === false) return;
      const nextWidth = measureColumnFitWidth({
        column: columnDef,
        rows: visibleRowsRef.current ?? [],
        font: readCellFont(wrapperRef.current),
      });
      commitWidth(columnId, nextWidth);
    },
    [commitWidth, visibleColumnDefs, wrapperRef],
  );

  return {
    isResizing: activeColumnId !== null,
    activeColumnId,
    onHandlePointerDown,
    onHandleDoubleClick,
  };
}

const DEFAULT_FONT = "400 14px/1.5 system-ui, sans-serif";

// Reads the font shorthand off the first body `<td>` inside the
// wrapper so canvas measurement uses the same metrics the browser will
// paint with. Falls back to a default when no row is rendered yet.
function readCellFont(wrap: HTMLElement | null): string {
  if (!wrap) return DEFAULT_FONT;
  const probe = wrap.querySelector(".data-table td") as HTMLElement | null;
  if (!probe) return DEFAULT_FONT;
  const style = window.getComputedStyle(probe);
  if (style.font) return style.font;
  // Some browsers leave the `font` shorthand empty; recompose.
  return `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize} / ${style.lineHeight} ${style.fontFamily}`;
}
