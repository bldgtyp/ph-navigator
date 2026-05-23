import { act, renderHook } from "@testing-library/react";
import { useRef, type MouseEvent as ReactMouseEvent } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useGridPointerDrag } from "../hooks/useGridPointerDrag";
import type { GridSelection } from "../hooks/useGridSelection";

// Selection stub. Only the four methods the drag hook touches need to
// be real; everything else returns harmless defaults so type-checking
// passes.
function makeSelection() {
  const setActive = vi.fn();
  const extendTo = vi.fn();
  const selection: GridSelection = {
    anchor: null,
    focus: null,
    activeCell: { rowIndex: 0, columnIndex: 0 },
    range: {
      anchor: { rowIndex: 0, columnIndex: 0 },
      focus: { rowIndex: 0, columnIndex: 0 },
    },
    normalizedRange: { rowStart: 0, rowEnd: 0, columnStart: 0, columnEnd: 0 },
    hasExplicitRange: false,
    setActive,
    extendTo,
    collapse: vi.fn(),
    selectRow: vi.fn(),
    selectColumn: vi.fn(),
    extendToColumn: vi.fn(),
    selectAll: vi.fn(),
    moveBy: vi.fn(),
  };
  return { selection, setActive, extendTo };
}

function makeContainer(rect: Partial<DOMRect> = {}) {
  const div = document.createElement("div");
  div.tabIndex = 0;
  const defaults = {
    top: 100,
    left: 100,
    right: 500,
    bottom: 500,
    width: 400,
    height: 400,
    x: 100,
    y: 100,
  };
  const bounds = { ...defaults, ...rect, toJSON: () => "{}" } as DOMRect;
  div.getBoundingClientRect = () => bounds;
  div.scrollBy = vi.fn();
  document.body.appendChild(div);
  return div;
}

function makeCell(rowId: string, fieldKey: string) {
  const td = document.createElement("td");
  td.dataset.rowId = rowId;
  td.dataset.fieldKey = fieldKey;
  document.body.appendChild(td);
  return td;
}

function syntheticCellMouseDown(
  cell: HTMLTableCellElement,
  options: Partial<MouseEvent> = {},
): ReactMouseEvent<HTMLTableCellElement> {
  const preventDefault = vi.fn();
  return {
    button: 0,
    clientX: 200,
    clientY: 200,
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    target: cell,
    currentTarget: cell,
    preventDefault,
    ...options,
  } as unknown as ReactMouseEvent<HTMLTableCellElement>;
}

// jsdom does not implement `document.elementFromPoint`, so the hook's
// hit-test path needs an explicit shim per test.
function stubElementFromPoint(resolve: (x: number, y: number) => Element | null) {
  (
    document as unknown as { elementFromPoint: (x: number, y: number) => Element | null }
  ).elementFromPoint = (x, y) => resolve(x, y);
}

function dispatchMouseMove(x: number, y: number) {
  const event = new MouseEvent("mousemove", { clientX: x, clientY: y, bubbles: true });
  document.dispatchEvent(event);
}

function dispatchMouseUp() {
  const event = new MouseEvent("mouseup", { bubbles: true });
  document.dispatchEvent(event);
}

function useDragHarness(
  selection: GridSelection,
  options: { isPointerInActiveEditor?: (target: EventTarget | null) => boolean } = {},
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  containerRef.current = harnessContainer;
  return useGridPointerDrag({
    containerRef,
    selection,
    isPointerInActiveEditor: options.isPointerInActiveEditor ?? (() => false),
  });
}

let harnessContainer: HTMLDivElement;
let rafQueue: FrameRequestCallback[] = [];

beforeEach(() => {
  harnessContainer = makeContainer();
  rafQueue = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function flushRaf() {
  const queue = rafQueue;
  rafQueue = [];
  for (const cb of queue) cb(performance.now());
}

describe("useGridPointerDrag — cell mode", () => {
  test("mousedown on a cell calls setActive and starts a drag session", () => {
    const { selection, setActive, extendTo } = makeSelection();
    const cell = makeCell("r1", "name");
    const { result } = renderHook(() => useDragHarness(selection));

    act(() => result.current.onCellMouseDown(syntheticCellMouseDown(cell)));

    expect(setActive).toHaveBeenCalledWith({ rowId: "r1", fieldKey: "name" });
    expect(extendTo).not.toHaveBeenCalled();
    expect(result.current.isDragging).toBe(true);
  });

  test("Shift+mousedown extends instead of setActive", () => {
    const { selection, setActive, extendTo } = makeSelection();
    const cell = makeCell("r1", "name");
    const { result } = renderHook(() => useDragHarness(selection));

    act(() => result.current.onCellMouseDown(syntheticCellMouseDown(cell, { shiftKey: true })));

    expect(extendTo).toHaveBeenCalledWith({ rowId: "r1", fieldKey: "name" });
    expect(setActive).not.toHaveBeenCalled();
  });

  test("document mousemove resolves the cell under the cursor and calls extendTo", () => {
    const { selection, extendTo } = makeSelection();
    const anchor = makeCell("r1", "name");
    const target = makeCell("r3", "count");
    const { result } = renderHook(() => useDragHarness(selection));
    act(() => result.current.onCellMouseDown(syntheticCellMouseDown(anchor)));

    // Stub elementFromPoint to return the target cell on the next move.
    stubElementFromPoint(() => target);
    act(() => dispatchMouseMove(250, 250));

    expect(extendTo).toHaveBeenCalledWith({ rowId: "r3", fieldKey: "count" });
  });

  test("mouseup tears down listeners and clears isDragging", () => {
    const { selection } = makeSelection();
    const cell = makeCell("r1", "name");
    const { result } = renderHook(() => useDragHarness(selection));
    act(() => result.current.onCellMouseDown(syntheticCellMouseDown(cell)));
    expect(result.current.isDragging).toBe(true);

    act(() => dispatchMouseUp());

    expect(result.current.isDragging).toBe(false);

    // Subsequent mousemove must not trigger any selection callback.
    const target = makeCell("r2", "name");
    stubElementFromPoint(() => target);
    const { extendTo } = makeSelection();
    selection.extendTo = extendTo;
    act(() => dispatchMouseMove(250, 250));
    expect(extendTo).not.toHaveBeenCalled();
  });

  test("cursor near bottom edge schedules autoscroll that calls scrollBy(0, +12)", () => {
    const { selection } = makeSelection();
    const cell = makeCell("r1", "name");
    const { result } = renderHook(() => useDragHarness(selection));
    act(() => result.current.onCellMouseDown(syntheticCellMouseDown(cell)));

    // Container bottom is at y=500; cursor at 490 is within 30 px.
    stubElementFromPoint(() => null);
    act(() => dispatchMouseMove(250, 490));
    expect(rafQueue.length).toBe(1);

    act(() => flushRaf());
    expect(harnessContainer.scrollBy).toHaveBeenCalledWith(0, 12);
    // After scrolling, the loop re-schedules itself for the next frame
    // as long as the cursor stays in the edge band.
    expect(rafQueue.length).toBe(1);
  });

  test("cursor near right edge schedules autoscroll that calls scrollBy(+12, 0)", () => {
    const { selection } = makeSelection();
    const cell = makeCell("r1", "name");
    const { result } = renderHook(() => useDragHarness(selection));
    act(() => result.current.onCellMouseDown(syntheticCellMouseDown(cell)));

    stubElementFromPoint(() => null);
    act(() => dispatchMouseMove(490, 250));
    act(() => flushRaf());

    expect(harnessContainer.scrollBy).toHaveBeenCalledWith(12, 0);
  });

  test("cursor in the interior does not schedule autoscroll", () => {
    const { selection } = makeSelection();
    const cell = makeCell("r1", "name");
    const { result } = renderHook(() => useDragHarness(selection));
    act(() => result.current.onCellMouseDown(syntheticCellMouseDown(cell)));

    stubElementFromPoint(() => null);
    act(() => dispatchMouseMove(300, 300));
    // ensureAutoScrollRunning enqueues a RAF; the loop callback should
    // see no edge band and not re-enqueue or call scrollBy.
    expect(rafQueue.length).toBe(1);
    act(() => flushRaf());
    expect(harnessContainer.scrollBy).not.toHaveBeenCalled();
    expect(rafQueue.length).toBe(0);
  });

  test("mousedown inside an active editor short-circuits the drag hook", () => {
    const { selection, setActive } = makeSelection();
    const cell = makeCell("r1", "name");
    const editor = document.createElement("input");
    editor.className = "data-table-cell-editor";
    cell.appendChild(editor);

    const { result } = renderHook(() =>
      useDragHarness(selection, {
        isPointerInActiveEditor: (target) =>
          target instanceof Element && target.classList.contains("data-table-cell-editor"),
      }),
    );

    act(() => result.current.onCellMouseDown(syntheticCellMouseDown(cell, { target: editor })));

    expect(setActive).not.toHaveBeenCalled();
    expect(result.current.isDragging).toBe(false);
  });

  test("mousedown on a gutter element short-circuits", () => {
    const { selection, setActive } = makeSelection();
    const cell = makeCell("r1", "name");
    const gutter = document.createElement("button");
    gutter.className = "data-table-gutter";
    cell.appendChild(gutter);

    const { result } = renderHook(() => useDragHarness(selection));

    act(() => result.current.onCellMouseDown(syntheticCellMouseDown(cell, { target: gutter })));

    expect(setActive).not.toHaveBeenCalled();
    expect(result.current.isDragging).toBe(false);
  });

  test("non-primary button is ignored", () => {
    const { selection, setActive } = makeSelection();
    const cell = makeCell("r1", "name");
    const { result } = renderHook(() => useDragHarness(selection));

    act(() => result.current.onCellMouseDown(syntheticCellMouseDown(cell, { button: 2 })));

    expect(setActive).not.toHaveBeenCalled();
    expect(result.current.isDragging).toBe(false);
  });

  test("cancel() restores the anchor and tears down listeners", () => {
    const { selection, setActive, extendTo } = makeSelection();
    const anchor = makeCell("r1", "name");
    const target = makeCell("r3", "count");
    const { result } = renderHook(() => useDragHarness(selection));
    act(() => result.current.onCellMouseDown(syntheticCellMouseDown(anchor)));

    vi.spyOn(document, "elementFromPoint").mockReturnValue(target);
    act(() => dispatchMouseMove(250, 250));
    expect(extendTo).toHaveBeenCalledWith({ rowId: "r3", fieldKey: "count" });

    setActive.mockClear();
    act(() => result.current.cancel());

    expect(setActive).toHaveBeenCalledWith({ rowId: "r1", fieldKey: "name" });
    expect(result.current.isDragging).toBe(false);

    // After cancel, further document moves must not call extendTo.
    extendTo.mockClear();
    act(() => dispatchMouseMove(260, 260));
    expect(extendTo).not.toHaveBeenCalled();
  });
});
