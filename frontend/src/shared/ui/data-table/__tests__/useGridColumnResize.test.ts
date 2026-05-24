import { act, renderHook } from "@testing-library/react";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useGridColumnResize } from "../hooks/useGridColumnResize";
import { emptyViewState, type DataTableColumnDef, type FieldDef, type ViewState } from "../types";

type Row = { id: string; name: string; count: number };

const columns: DataTableColumnDef<Row>[] = [
  { id: "name", fieldKey: "name", header: "Name", accessor: (r) => r.name, defaultWidth: 200 },
  {
    id: "count",
    fieldKey: "count",
    header: "Count",
    accessor: (r) => r.count,
    defaultWidth: 120,
  },
  {
    id: "locked",
    fieldKey: "locked",
    header: "Locked",
    accessor: () => null,
    defaultWidth: 150,
    resizable: false,
  },
];
const fieldDefs: FieldDef[] = [
  { field_key: "name", field_type: "text", display_name: "Name" },
  { field_key: "count", field_type: "number", display_name: "Count" },
  { field_key: "locked", field_type: "text", display_name: "Locked" },
];
const fieldDefByKey = new Map(fieldDefs.map((fd) => [fd.field_key, fd]));

function makeHandle() {
  const el = document.createElement("div");
  el.setPointerCapture = vi.fn();
  el.releasePointerCapture = vi.fn();
  return el;
}

function makeWrapper() {
  return document.createElement("div");
}

function pointerDown(
  el: HTMLElement,
  options: { clientX?: number; pointerId?: number; button?: number } = {},
) {
  return {
    button: options.button ?? 0,
    clientX: options.clientX ?? 0,
    pointerId: options.pointerId ?? 1,
    currentTarget: el,
    target: el,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as ReactPointerEvent<HTMLElement>;
}

function dispatchPointerMove(clientX: number, pointerId = 1) {
  const event = new Event("pointermove") as PointerEvent;
  Object.assign(event, { clientX, pointerId });
  document.dispatchEvent(event);
}

function dispatchPointerUp(pointerId = 1) {
  const event = new Event("pointerup") as PointerEvent;
  Object.assign(event, { pointerId });
  document.dispatchEvent(event);
}

function dispatchEscape() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
}

function setup(initialView: ViewState = emptyViewState()) {
  const wrapper = makeWrapper();
  let view: ViewState = initialView;
  const onViewChange = vi.fn((next: ViewState) => {
    view = next;
  });
  const { result, rerender } = renderHook(
    ({ v }: { v: ViewState }) => {
      const wrapperRef = useRef(wrapper);
      return useGridColumnResize({
        view: v,
        onViewChange,
        visibleColumnDefs: columns,
        fieldDefByKey,
        wrapperRef,
      });
    },
    { initialProps: { v: view } },
  );
  const reflectLatestView = () => rerender({ v: view });
  return { hook: result, onViewChange, wrapper, reflectLatestView, getView: () => view };
}

describe("useGridColumnResize", () => {
  let originalRaf: typeof window.requestAnimationFrame;

  beforeEach(() => {
    originalRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    }) as typeof window.requestAnimationFrame;
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRaf;
  });

  test("drag updates view.columnWidths during pointermove and finalizes on pointerup", () => {
    const { hook, onViewChange, wrapper, reflectLatestView, getView } = setup();
    const handle = makeHandle();

    act(() => {
      hook.current.onHandlePointerDown("name", pointerDown(handle, { clientX: 500 }));
    });
    expect(hook.current.activeColumnId).toBe("name");
    expect(wrapper.getAttribute("data-column-resizing")).toBe("true");

    act(() => {
      dispatchPointerMove(540);
    });
    reflectLatestView();
    expect(getView().columnWidths.name).toBe(240);

    act(() => {
      dispatchPointerMove(560);
    });
    reflectLatestView();
    expect(getView().columnWidths.name).toBe(260);

    act(() => {
      dispatchPointerUp();
    });
    expect(hook.current.activeColumnId).toBeNull();
    expect(wrapper.getAttribute("data-column-resizing")).toBeNull();
    expect(getView().columnWidths.name).toBe(260);
    expect(onViewChange.mock.calls.length).toBeGreaterThan(0);
  });

  test("Escape during drag cancels and removes the persisted width when none existed before", () => {
    const { hook, reflectLatestView, getView } = setup();
    const handle = makeHandle();

    act(() => {
      hook.current.onHandlePointerDown("name", pointerDown(handle, { clientX: 500 }));
    });
    act(() => {
      dispatchPointerMove(600);
    });
    reflectLatestView();
    expect(getView().columnWidths.name).toBe(300);

    act(() => {
      dispatchEscape();
    });
    expect(hook.current.activeColumnId).toBeNull();
    expect(getView().columnWidths.name).toBeUndefined();
  });

  test("Escape during drag restores the prior persisted width when one existed", () => {
    const { hook, reflectLatestView, getView } = setup({
      ...emptyViewState(),
      columnWidths: { name: 220 },
    });
    const handle = makeHandle();

    act(() => {
      hook.current.onHandlePointerDown("name", pointerDown(handle, { clientX: 500 }));
    });
    act(() => {
      dispatchPointerMove(700);
    });
    reflectLatestView();
    expect(getView().columnWidths.name).toBeGreaterThan(220);

    act(() => {
      dispatchEscape();
    });
    expect(getView().columnWidths.name).toBe(220);
  });

  test("drag clamps to the global minimum and maximum", () => {
    const { hook, reflectLatestView, getView } = setup();
    const handle = makeHandle();

    act(() => {
      hook.current.onHandlePointerDown("name", pointerDown(handle, { clientX: 500 }));
    });
    act(() => {
      // Drag far left → clamps at GLOBAL_MIN_WIDTH (60).
      dispatchPointerMove(0);
    });
    reflectLatestView();
    expect(getView().columnWidths.name).toBe(60);

    act(() => {
      // Drag far right → clamps at GLOBAL_MAX_WIDTH (800).
      dispatchPointerMove(99999);
    });
    reflectLatestView();
    expect(getView().columnWidths.name).toBe(800);

    act(() => {
      dispatchPointerUp();
    });
  });

  test("non-resizable columns ignore pointer-down", () => {
    const { hook, onViewChange } = setup();
    const handle = makeHandle();

    act(() => {
      hook.current.onHandlePointerDown("locked", pointerDown(handle, { clientX: 500 }));
    });
    expect(hook.current.activeColumnId).toBeNull();
    expect(onViewChange).not.toHaveBeenCalled();
  });

  test("right-button pointer-down does not start a drag", () => {
    const { hook } = setup();
    const handle = makeHandle();

    act(() => {
      hook.current.onHandlePointerDown("name", pointerDown(handle, { clientX: 500, button: 2 }));
    });
    expect(hook.current.activeColumnId).toBeNull();
  });

  test("double-click fires onViewChange with a fit-to-content width", () => {
    // Stub canvas so measureColumnFitWidth has a deterministic context.
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: string) {
      if (kind === "2d") {
        return {
          font: "",
          measureText: (text: string) => ({ width: text.length * 7 }),
        } as unknown as CanvasRenderingContext2D;
      }
      return null;
    } as typeof HTMLCanvasElement.prototype.getContext;
    try {
      const { hook, onViewChange } = setup();
      act(() => {
        hook.current.onHandleDoubleClick("name");
      });
      expect(onViewChange).toHaveBeenCalledTimes(1);
      const call = onViewChange.mock.calls[0]?.[0] as ViewState;
      expect(call.columnWidths.name).toBeGreaterThan(0);
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
  });

  test("double-click on a non-resizable column is a no-op", () => {
    const { hook, onViewChange } = setup();
    act(() => {
      hook.current.onHandleDoubleClick("locked");
    });
    expect(onViewChange).not.toHaveBeenCalled();
  });
});
