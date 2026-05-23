import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useGridRowSelection } from "../hooks/useGridRowSelection";

const ROWS = ["a", "b", "c", "d", "e"];

describe("useGridRowSelection", () => {
  test("starts empty with no anchor", () => {
    const { result } = renderHook(() => useGridRowSelection({ rowIds: ROWS }));
    expect(result.current.count).toBe(0);
    expect(result.current.anchorRowId).toBeNull();
    expect(result.current.isSelected("a")).toBe(false);
  });

  test("single mode replaces the set and sets the anchor", () => {
    const { result } = renderHook(() => useGridRowSelection({ rowIds: ROWS }));
    act(() => result.current.toggle("b", "single"));
    expect(Array.from(result.current.selectedRowIds)).toEqual(["b"]);
    expect(result.current.anchorRowId).toBe("b");
    act(() => result.current.toggle("d", "single"));
    expect(Array.from(result.current.selectedRowIds)).toEqual(["d"]);
    expect(result.current.anchorRowId).toBe("d");
  });

  test("single mode toggles off when the same row is clicked again (Phase 3 R2)", () => {
    const { result } = renderHook(() => useGridRowSelection({ rowIds: ROWS }));

    act(() => result.current.toggle("b", "single"));
    expect(Array.from(result.current.selectedRowIds)).toEqual(["b"]);
    expect(result.current.anchorRowId).toBe("b");

    act(() => result.current.toggle("b", "single"));
    expect(result.current.count).toBe(0);
    expect(result.current.anchorRowId).toBeNull();
  });

  test("single mode on a multi-row set replaces with the clicked row", () => {
    const { result } = renderHook(() => useGridRowSelection({ rowIds: ROWS }));

    act(() => result.current.toggle("a", "single"));
    act(() => result.current.toggle("c", "shift")); // set = {a, b, c}
    expect(result.current.count).toBe(3);

    act(() => result.current.toggle("b", "single")); // replace, not toggle off
    expect(Array.from(result.current.selectedRowIds)).toEqual(["b"]);
    expect(result.current.anchorRowId).toBe("b");
  });

  test("shift mode without a prior anchor falls through to single", () => {
    const { result } = renderHook(() => useGridRowSelection({ rowIds: ROWS }));
    act(() => result.current.toggle("c", "shift"));
    expect(Array.from(result.current.selectedRowIds)).toEqual(["c"]);
    expect(result.current.anchorRowId).toBe("c");
  });

  test("shift mode extends the set from the anchor to the target", () => {
    const { result } = renderHook(() => useGridRowSelection({ rowIds: ROWS }));
    act(() => result.current.toggle("b", "single"));
    act(() => result.current.toggle("d", "shift"));
    expect(Array.from(result.current.selectedRowIds).sort()).toEqual(["b", "c", "d"]);
    expect(result.current.anchorRowId).toBe("b");
  });

  test("shift mode works in either direction from the anchor", () => {
    const { result } = renderHook(() => useGridRowSelection({ rowIds: ROWS }));
    act(() => result.current.toggle("d", "single"));
    act(() => result.current.toggle("b", "shift"));
    expect(Array.from(result.current.selectedRowIds).sort()).toEqual(["b", "c", "d"]);
    expect(result.current.anchorRowId).toBe("d");
  });

  test("cmd mode toggles a single row without touching the rest of the set", () => {
    const { result } = renderHook(() => useGridRowSelection({ rowIds: ROWS }));
    act(() => result.current.toggle("a", "single"));
    act(() => result.current.toggle("c", "cmd"));
    act(() => result.current.toggle("e", "cmd"));
    expect(Array.from(result.current.selectedRowIds).sort()).toEqual(["a", "c", "e"]);
    expect(result.current.anchorRowId).toBe("a");
    act(() => result.current.toggle("c", "cmd"));
    expect(Array.from(result.current.selectedRowIds).sort()).toEqual(["a", "e"]);
  });

  test("cmd mode that empties the set drops the anchor", () => {
    const { result } = renderHook(() => useGridRowSelection({ rowIds: ROWS }));
    act(() => result.current.toggle("b", "single"));
    act(() => result.current.toggle("b", "cmd"));
    expect(result.current.count).toBe(0);
    expect(result.current.anchorRowId).toBeNull();
  });

  test("clear empties the set and the anchor", () => {
    const { result } = renderHook(() => useGridRowSelection({ rowIds: ROWS }));
    act(() => result.current.toggle("b", "single"));
    act(() => result.current.toggle("d", "shift"));
    act(() => result.current.clear());
    expect(result.current.count).toBe(0);
    expect(result.current.anchorRowId).toBeNull();
  });

  test("unknown rowId is a no-op", () => {
    const { result } = renderHook(() => useGridRowSelection({ rowIds: ROWS }));
    act(() => result.current.toggle("ghost", "single"));
    expect(result.current.count).toBe(0);
    expect(result.current.anchorRowId).toBeNull();
  });

  test("clears the set when the rowIds array identity changes", () => {
    const initialRows = ["a", "b", "c"];
    const { result, rerender } = renderHook(({ rowIds }) => useGridRowSelection({ rowIds }), {
      initialProps: { rowIds: initialRows },
    });
    act(() => result.current.toggle("b", "single"));
    expect(result.current.count).toBe(1);

    rerender({ rowIds: ["a", "b", "c"] }); // new identity, same content

    expect(result.current.count).toBe(0);
    expect(result.current.anchorRowId).toBeNull();
  });
});
