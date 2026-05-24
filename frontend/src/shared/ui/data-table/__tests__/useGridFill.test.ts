import { act, renderHook } from "@testing-library/react";
import { useRef, type MouseEvent as ReactMouseEvent } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useGridFill } from "../hooks/useGridFill";
import type { GridSelection } from "../hooks/useGridSelection";
import type { DataTableColumnDef, FieldDef, WriteOp } from "../types";

type Row = { id: string; name: string; floor: string };

const rows: Row[] = [
  { id: "rm_1", name: "A", floor: "1st" },
  { id: "rm_2", name: "B", floor: "1st" },
  { id: "rm_3", name: "C", floor: "1st" },
  { id: "rm_4", name: "D", floor: "2nd" },
  { id: "rm_5", name: "E", floor: "2nd" },
];

const columns: DataTableColumnDef<Row>[] = [
  { id: "name", fieldKey: "name", header: "Name", accessor: (row) => row.name },
  { id: "floor", fieldKey: "floor", header: "Floor", accessor: (row) => row.floor },
];

const fieldDefs: FieldDef[] = [
  { field_key: "name", field_type: "text", display_name: "Name" },
  { field_key: "floor", field_type: "text", display_name: "Floor" },
];

const ungroupedPath = new Map<string, string>(rows.map((row) => [row.id, ""]));
const groupedPath = new Map<string, string>([
  ["rm_1", "1st"],
  ["rm_2", "1st"],
  ["rm_3", "1st"],
  ["rm_4", "2nd"],
  ["rm_5", "2nd"],
]);

function makeSelection(
  normalizedRange: { rowStart: number; rowEnd: number; columnStart: number; columnEnd: number },
): GridSelection {
  return {
    anchor: null,
    focus: null,
    activeCell: { rowIndex: normalizedRange.rowStart, columnIndex: normalizedRange.columnStart },
    range: {
      anchor: { rowIndex: normalizedRange.rowStart, columnIndex: normalizedRange.columnStart },
      focus: { rowIndex: normalizedRange.rowEnd, columnIndex: normalizedRange.columnEnd },
    },
    normalizedRange,
    hasExplicitRange: false,
    setActive: vi.fn(),
    extendTo: vi.fn(),
    collapse: vi.fn(),
    selectRow: vi.fn(),
    selectColumn: vi.fn(),
    extendToColumn: vi.fn(),
    selectAll: vi.fn(),
    moveBy: vi.fn(),
  };
}

function makeContainer() {
  const div = document.createElement("div");
  div.tabIndex = 0;
  const bounds = {
    top: 100,
    left: 100,
    right: 500,
    bottom: 500,
    width: 400,
    height: 400,
    x: 100,
    y: 100,
    toJSON: () => "{}",
  } as DOMRect;
  div.getBoundingClientRect = () => bounds;
  div.scrollBy = vi.fn();
  document.body.appendChild(div);
  return div;
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

type HarnessArgs = {
  selection: GridSelection;
  groupPathByRowId?: Map<string, string>;
  readOnly?: boolean;
  isEditing?: boolean;
  hasWriteHandler?: boolean;
  dispatchWrite?: ReturnType<typeof vi.fn>;
  onAnnounce?: ReturnType<typeof vi.fn>;
};

function useHarness(args: HarnessArgs) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  containerRef.current = harnessContainer;
  return useGridFill({
    containerRef,
    selection: args.selection,
    rows,
    rowIds: rows.map((row) => row.id),
    fieldKeys: columns.map((c) => c.fieldKey),
    columns,
    fieldDefs,
    getRowId: (row) => row.id,
    groupPathByRowId: args.groupPathByRowId ?? ungroupedPath,
    dispatchWrite: args.dispatchWrite ?? vi.fn().mockResolvedValue(undefined),
    readOnly: args.readOnly ?? false,
    isEditing: args.isEditing ?? false,
    hasWriteHandler: args.hasWriteHandler ?? true,
    onAnnounce: args.onAnnounce ?? vi.fn(),
  });
}

function stubElementFromPoint(target: Element | null) {
  (
    document as unknown as { elementFromPoint: (x: number, y: number) => Element | null }
  ).elementFromPoint = () => target;
}

function syntheticMouseDown(): ReactMouseEvent<HTMLElement> {
  const stopPropagation = vi.fn();
  const preventDefault = vi.fn();
  return {
    button: 0,
    clientX: 100,
    clientY: 100,
    stopPropagation,
    preventDefault,
  } as unknown as ReactMouseEvent<HTMLElement>;
}

describe("useGridFill — handleVisible", () => {
  test("is false when readOnly", () => {
    const selection = makeSelection({ rowStart: 0, rowEnd: 0, columnStart: 0, columnEnd: 0 });
    const { result } = renderHook(() => useHarness({ selection, readOnly: true }));
    expect(result.current.handleVisible).toBe(false);
    expect(result.current.source).toBe(null);
  });

  test("is false when editing", () => {
    const selection = makeSelection({ rowStart: 0, rowEnd: 0, columnStart: 0, columnEnd: 0 });
    const { result } = renderHook(() => useHarness({ selection, isEditing: true }));
    expect(result.current.handleVisible).toBe(false);
  });

  test("is false when no write handler", () => {
    const selection = makeSelection({ rowStart: 0, rowEnd: 0, columnStart: 0, columnEnd: 0 });
    const { result } = renderHook(() => useHarness({ selection, hasWriteHandler: false }));
    expect(result.current.handleVisible).toBe(false);
  });

  test("is true on a valid 1×1 selection in an ungrouped view", () => {
    const selection = makeSelection({ rowStart: 0, rowEnd: 0, columnStart: 0, columnEnd: 0 });
    const { result } = renderHook(() => useHarness({ selection }));
    expect(result.current.handleVisible).toBe(true);
    expect(result.current.source).toEqual({
      rowStart: 0,
      rowEnd: 0,
      columnStart: 0,
      columnEnd: 0,
    });
  });

  test("is false when the source spans two groups", () => {
    const selection = makeSelection({ rowStart: 1, rowEnd: 4, columnStart: 0, columnEnd: 0 });
    const { result } = renderHook(() =>
      useHarness({ selection, groupPathByRowId: groupedPath }),
    );
    expect(result.current.handleVisible).toBe(false);
    expect(result.current.source).toBe(null);
  });

  test("is true on a multi-row source within one group", () => {
    const selection = makeSelection({ rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 0 });
    const { result } = renderHook(() =>
      useHarness({ selection, groupPathByRowId: groupedPath }),
    );
    expect(result.current.handleVisible).toBe(true);
  });
});

describe("useGridFill — fillDown", () => {
  test("no-op + announce when selection is single-row", async () => {
    const onAnnounce = vi.fn();
    const dispatchWrite = vi.fn().mockResolvedValue(undefined);
    const selection = makeSelection({ rowStart: 0, rowEnd: 0, columnStart: 0, columnEnd: 0 });
    const { result } = renderHook(() => useHarness({ selection, onAnnounce, dispatchWrite }));
    await act(async () => {
      await result.current.fillDown();
    });
    expect(dispatchWrite).not.toHaveBeenCalled();
    expect(onAnnounce).toHaveBeenCalledWith("Select more than one row to fill down.");
  });

  test("dispatches one fill op for a single-group range", async () => {
    const onAnnounce = vi.fn();
    const dispatchWrite = vi.fn().mockResolvedValue(undefined);
    const selection = makeSelection({ rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 0 });
    const { result } = renderHook(() => useHarness({ selection, onAnnounce, dispatchWrite }));
    await act(async () => {
      await result.current.fillDown();
    });
    expect(dispatchWrite).toHaveBeenCalledTimes(1);
    const [op, inverse] = dispatchWrite.mock.calls[0]!;
    expect((op as WriteOp).kind).toBe("fill");
    if ((op as WriteOp).kind === "fill") {
      expect((op as { writes: unknown[] }).writes).toHaveLength(2);
    }
    expect((inverse as WriteOp).kind).toBe("cell");
    expect(onAnnounce).toHaveBeenCalledWith("2 cells filled.");
  });

  test("multi-group selection produces ONE op with concatenated writes from each sub-range", async () => {
    const dispatchWrite = vi.fn().mockResolvedValue(undefined);
    // rows 1..4: rm_2, rm_3 (1st), rm_4, rm_5 (2nd). Sub-ranges:
    // [1..2] source rm_2, target rm_3; [3..4] source rm_4, target rm_5.
    const selection = makeSelection({ rowStart: 1, rowEnd: 4, columnStart: 0, columnEnd: 0 });
    const { result } = renderHook(() =>
      useHarness({ selection, dispatchWrite, groupPathByRowId: groupedPath }),
    );
    await act(async () => {
      await result.current.fillDown();
    });
    expect(dispatchWrite).toHaveBeenCalledTimes(1);
    const [op] = dispatchWrite.mock.calls[0]! as [WriteOp];
    if (op.kind !== "fill") throw new Error("expected fill op");
    expect(op.writes).toHaveLength(2);
    expect(op.writes.map((w) => w.rowId)).toEqual(["rm_3", "rm_5"]);
    expect(op.writes.map((w) => w.value)).toEqual(["B", "D"]);
  });
});

describe("useGridFill — fillRight", () => {
  test("no-op when selection is single-column", async () => {
    const onAnnounce = vi.fn();
    const dispatchWrite = vi.fn().mockResolvedValue(undefined);
    const selection = makeSelection({ rowStart: 0, rowEnd: 0, columnStart: 0, columnEnd: 0 });
    const { result } = renderHook(() => useHarness({ selection, onAnnounce, dispatchWrite }));
    await act(async () => {
      await result.current.fillRight();
    });
    expect(dispatchWrite).not.toHaveBeenCalled();
    expect(onAnnounce).toHaveBeenCalledWith("Select more than one column to fill right.");
  });

  test("dispatches one fill op for a multi-column selection", async () => {
    const dispatchWrite = vi.fn().mockResolvedValue(undefined);
    const selection = makeSelection({ rowStart: 0, rowEnd: 0, columnStart: 0, columnEnd: 1 });
    const { result } = renderHook(() => useHarness({ selection, dispatchWrite }));
    await act(async () => {
      await result.current.fillRight();
    });
    expect(dispatchWrite).toHaveBeenCalledTimes(1);
    const [op] = dispatchWrite.mock.calls[0]! as [WriteOp];
    if (op.kind !== "fill") throw new Error("expected fill op");
    expect(op.writes).toHaveLength(1);
    expect(op.writes[0]!.fieldKey).toBe("floor");
  });
});

describe("useGridFill — drag lifecycle", () => {
  test("handle mousedown sets isDragging and attaches document listeners; mouseup commits", async () => {
    const dispatchWrite = vi.fn().mockResolvedValue(undefined);
    const onAnnounce = vi.fn();
    const selection = makeSelection({ rowStart: 0, rowEnd: 0, columnStart: 0, columnEnd: 0 });
    const { result } = renderHook(() => useHarness({ selection, dispatchWrite, onAnnounce }));

    // Stub elementFromPoint to a target cell in row 2.
    const cell = document.createElement("td");
    cell.dataset.rowId = "rm_3";
    cell.dataset.fieldKey = "name";
    document.body.appendChild(cell);
    stubElementFromPoint(cell);

    const event = syntheticMouseDown();
    act(() => {
      result.current.onHandleMouseDown(event);
    });
    expect(result.current.isDragging).toBe(true);
    expect((event.stopPropagation as ReturnType<typeof vi.fn>)).toHaveBeenCalled();

    // Pointer moves enough to cross the axis threshold vertically.
    act(() => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 100, clientY: 200 }));
    });
    expect(result.current.targetPreview).not.toBe(null);

    await act(async () => {
      document.dispatchEvent(new MouseEvent("mouseup"));
      // Flush the microtask queue so the awaited dispatchWrite + teardown resolve.
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(dispatchWrite).toHaveBeenCalledTimes(1);
    expect(result.current.isDragging).toBe(false);
  });

  test("cancel() tears down without committing", async () => {
    const dispatchWrite = vi.fn().mockResolvedValue(undefined);
    const selection = makeSelection({ rowStart: 0, rowEnd: 0, columnStart: 0, columnEnd: 0 });
    const { result } = renderHook(() => useHarness({ selection, dispatchWrite }));

    const event = syntheticMouseDown();
    act(() => {
      result.current.onHandleMouseDown(event);
    });
    expect(result.current.isDragging).toBe(true);
    act(() => {
      result.current.cancel();
    });
    expect(result.current.isDragging).toBe(false);
    expect(dispatchWrite).not.toHaveBeenCalled();
  });
});

describe("useGridFill — group clamp announce", () => {
  test("fires Fill clamped to group bottom once per drag session", () => {
    const onAnnounce = vi.fn();
    const selection = makeSelection({ rowStart: 0, rowEnd: 0, columnStart: 0, columnEnd: 0 });
    const { result } = renderHook(() =>
      useHarness({ selection, onAnnounce, groupPathByRowId: groupedPath }),
    );
    // Stub elementFromPoint to a cell in row 3 (rm_4, "2nd" group) so
    // the target rectangle would extend past the "1st" group bottom.
    const cell = document.createElement("td");
    cell.dataset.rowId = "rm_4";
    cell.dataset.fieldKey = "name";
    document.body.appendChild(cell);
    stubElementFromPoint(cell);
    act(() => {
      result.current.onHandleMouseDown(syntheticMouseDown());
    });
    act(() => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 100, clientY: 300 }));
    });
    // Should announce clamp once.
    const clampCalls = onAnnounce.mock.calls.filter(
      ([msg]) => msg === "Fill clamped to group bottom.",
    );
    expect(clampCalls).toHaveLength(1);
    // Second mousemove past the boundary must not re-announce.
    act(() => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 100, clientY: 320 }));
    });
    const clampCallsAfter = onAnnounce.mock.calls.filter(
      ([msg]) => msg === "Fill clamped to group bottom.",
    );
    expect(clampCallsAfter).toHaveLength(1);
  });
});
