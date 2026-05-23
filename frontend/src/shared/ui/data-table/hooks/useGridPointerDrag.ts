import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { GridSelection } from "./useGridSelection";

// Phase 3 §4.3: document-level pointer tracking for rectangular range
// selection. Listeners attach only while a drag session is active so
// idle CPU stays at zero. `elementFromPoint` is the single hit-test
// path; cells expose `data-row-id` / `data-field-key` (Phase 3 §4.8)
// and the drag hook resolves the cursor against them every mousemove
// and every auto-scroll frame.
//
// Selection state still lives in `useGridSelection`; this hook is the
// orchestrator that translates raw pointer events into `setActive` /
// `extendTo` calls.

const EDGE_PX = 30;
const SCROLL_PX = 12;

export type GridDragMode = "cell" | "column";

type DragSession =
  | { mode: "cell"; anchor: { rowId: string; fieldKey: string } }
  | { mode: "column"; anchorFieldKey: string };

export type GridPointerDrag = {
  isDragging: boolean;
  onCellMouseDown: (event: ReactMouseEvent<HTMLTableCellElement>) => void;
  onColumnMouseDown: (event: ReactMouseEvent<HTMLElement>, fieldKey: string) => void;
  cancel: () => void;
};

export type UseGridPointerDragArgs = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  selection: GridSelection;
  // Returns true when the mousedown target sits inside an active
  // editor (the inline <input> or the single-select popover). The hook
  // bails entirely in that case so native text-selection inside the
  // editor works.
  isPointerInActiveEditor: (target: EventTarget | null) => boolean;
};

export function useGridPointerDrag(args: UseGridPointerDragArgs): GridPointerDrag {
  const { containerRef, selection, isPointerInActiveEditor } = args;
  const [isDragging, setIsDragging] = useState(false);
  const sessionRef = useRef<DragSession | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // The cell-address resolver and the document handlers all need the
  // latest `selection.extendTo` etc. Keep refs so handlers attached at
  // drag-start time still see the current callback if the parent
  // re-renders mid-drag.
  const extendToRef = useRef(selection.extendTo);
  const setActiveRef = useRef(selection.setActive);
  const selectColumnRef = useRef(selection.selectColumn);
  const extendToColumnRef = useRef(selection.extendToColumn);
  useEffect(() => {
    extendToRef.current = selection.extendTo;
    setActiveRef.current = selection.setActive;
    selectColumnRef.current = selection.selectColumn;
    extendToColumnRef.current = selection.extendToColumn;
  }, [selection.extendTo, selection.setActive, selection.selectColumn, selection.extendToColumn]);

  const stopAutoScroll = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const teardown = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    sessionRef.current = null;
    lastPointerRef.current = null;
    stopAutoScroll();
    setIsDragging(false);
  }, [stopAutoScroll]);

  const cancel = useCallback(() => {
    const session = sessionRef.current;
    if (session?.mode === "cell") {
      setActiveRef.current(session.anchor);
    } else if (session?.mode === "column") {
      selectColumnRef.current(session.anchorFieldKey);
    }
    teardown();
  }, [teardown]);

  // Resolve the current pointer position to a cell address by walking
  // up from `elementFromPoint` to the nearest `<td data-row-id data-
  // field-key>`. Returns null when the cursor is over chrome (gutter,
  // header, scrollbar) so the focus stays put rather than snapping to
  // an unrelated cell.
  const resolvePointerToCell = useCallback(() => {
    const pointer = lastPointerRef.current;
    if (!pointer) return;
    const session = sessionRef.current;
    if (!session) return;
    const target = document.elementFromPoint(pointer.x, pointer.y);
    if (!(target instanceof Element)) return;
    if (session.mode === "cell") {
      const cellEl = target.closest("td[data-row-id][data-field-key]");
      if (!(cellEl instanceof HTMLElement)) return;
      const rowId = cellEl.dataset.rowId;
      const fieldKey = cellEl.dataset.fieldKey;
      if (!rowId || !fieldKey) return;
      extendToRef.current({ rowId, fieldKey });
      return;
    }
    // column mode — resolve to the nearest column-select strip and
    // extend across columns. The body <td>s also carry `data-field-
    // key`, so a column drag that travels down into the body still
    // resolves to the right column via the cell's fieldKey.
    const stripEl = target.closest("[data-column-select-fieldkey]");
    if (stripEl instanceof HTMLElement) {
      const fieldKey = stripEl.dataset.columnSelectFieldkey;
      if (fieldKey) extendToColumnRef.current(fieldKey);
      return;
    }
    const cellEl = target.closest("td[data-field-key]");
    if (cellEl instanceof HTMLElement) {
      const fieldKey = cellEl.dataset.fieldKey;
      if (fieldKey) extendToColumnRef.current(fieldKey);
    }
  }, []);

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
    // The cursor stayed at the same viewport coordinate but the
    // content underneath it moved — re-resolve so focus follows.
    resolvePointerToCell();
    rafIdRef.current = requestAnimationFrame(autoScrollFrame);
  }, [containerRef, resolvePointerToCell]);

  const ensureAutoScrollRunning = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(autoScrollFrame);
  }, [autoScrollFrame]);

  // Both modes need the same document listener setup and the same
  // focus-recapture dance. Factored out so the two mousedown handlers
  // stay focused on mode-specific work.
  const startSession = useCallback(
    (session: DragSession, pointer: { x: number; y: number }) => {
      sessionRef.current = session;
      lastPointerRef.current = pointer;
      setIsDragging(true);
      // The drag-start mousedown was default-prevented (cell handler
      // suppresses native text-selection; column handler suppresses the
      // browser's default focus-on-mousedown on the strip), so refocus
      // the wrapper explicitly. Keeps Esc / ⌘C / arrows aimed at the
      // grid.
      containerRef.current?.focus({ preventScroll: true });

      const handleMouseMove = (moveEvent: MouseEvent) => {
        lastPointerRef.current = { x: moveEvent.clientX, y: moveEvent.clientY };
        resolvePointerToCell();
        ensureAutoScrollRunning();
      };
      const handleMouseUp = () => {
        teardown();
      };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      // Safety net for releases the OS routes through pointerup before
      // mouseup reaches the document (iframes, drag-out cases).
      document.addEventListener("pointerup", handleMouseUp, { once: true });

      cleanupRef.current = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.removeEventListener("pointerup", handleMouseUp);
      };
    },
    [containerRef, ensureAutoScrollRunning, resolvePointerToCell, teardown],
  );

  const onCellMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLTableCellElement>) => {
      if (event.button !== 0) return;
      if (isPointerInActiveEditor(event.target)) return;
      const targetEl = event.target instanceof Element ? event.target : null;
      // Gutter clicks own their own row-selection / row-number semantics
      // (Phase 2). Never start a cell drag from them.
      if (targetEl?.closest(".data-table-gutter")) return;
      const cellEl = (event.currentTarget as HTMLElement | null) ?? null;
      if (!cellEl) return;
      const rowId = cellEl.dataset.rowId;
      const fieldKey = cellEl.dataset.fieldKey;
      if (!rowId || !fieldKey) return;

      const addr = { rowId, fieldKey };
      if (event.shiftKey) extendToRef.current(addr);
      else setActiveRef.current(addr);

      event.preventDefault();
      startSession({ mode: "cell", anchor: addr }, { x: event.clientX, y: event.clientY });
    },
    [isPointerInActiveEditor, startSession],
  );

  const onColumnMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLElement>, fieldKey: string) => {
      if (event.button !== 0) return;
      if (!fieldKey) return;

      if (event.shiftKey) extendToColumnRef.current(fieldKey);
      else selectColumnRef.current(fieldKey);

      event.preventDefault();
      startSession(
        { mode: "column", anchorFieldKey: fieldKey },
        { x: event.clientX, y: event.clientY },
      );
    },
    [startSession],
  );

  useEffect(() => {
    return () => {
      // Unmount-time safety: tear down any lingering listeners.
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  return { isDragging, onCellMouseDown, onColumnMouseDown, cancel };
}
