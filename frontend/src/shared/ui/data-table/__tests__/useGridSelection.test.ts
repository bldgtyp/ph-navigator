import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useGridSelection } from "../hooks/useGridSelection";

const FIELDS = ["number", "name", "count"];

describe("useGridSelection", () => {
  test("defaults focus to the top-left cell", () => {
    const { result } = renderHook(() =>
      useGridSelection({ rowIds: ["a", "b"], fieldKeys: FIELDS }),
    );

    expect(result.current.activeCell).toEqual({ rowIndex: 0, columnIndex: 0 });
    expect(result.current.hasExplicitRange).toBe(false);
    expect(result.current.normalizedRange).toEqual({
      rowStart: 0,
      rowEnd: 0,
      columnStart: 0,
      columnEnd: 0,
    });
  });

  test("setActive collapses focus to a single cell", () => {
    const { result } = renderHook(() =>
      useGridSelection({ rowIds: ["a", "b", "c"], fieldKeys: FIELDS }),
    );

    act(() => result.current.setActive({ rowId: "b", fieldKey: "name" }));

    expect(result.current.activeCell).toEqual({ rowIndex: 1, columnIndex: 1 });
    expect(result.current.hasExplicitRange).toBe(false);
  });

  test("moveBy with shift extends the range", () => {
    const { result } = renderHook(() =>
      useGridSelection({ rowIds: ["a", "b", "c"], fieldKeys: FIELDS }),
    );
    act(() => result.current.setActive({ rowId: "a", fieldKey: "number" }));

    act(() => result.current.moveBy("ArrowDown", true));

    expect(result.current.hasExplicitRange).toBe(true);
    expect(result.current.normalizedRange).toEqual({
      rowStart: 0,
      rowEnd: 1,
      columnStart: 0,
      columnEnd: 0,
    });
  });

  test("moveBy without shift moves the active cell and collapses", () => {
    const { result } = renderHook(() =>
      useGridSelection({ rowIds: ["a", "b", "c"], fieldKeys: FIELDS }),
    );
    act(() => result.current.setActive({ rowId: "a", fieldKey: "number" }));
    act(() => result.current.moveBy("ArrowDown", true));

    act(() => result.current.moveBy("ArrowDown", false));

    expect(result.current.hasExplicitRange).toBe(false);
    expect(result.current.activeCell).toEqual({ rowIndex: 2, columnIndex: 0 });
  });

  test("selectAll spans the full grid", () => {
    const { result } = renderHook(() =>
      useGridSelection({ rowIds: ["a", "b", "c"], fieldKeys: FIELDS }),
    );

    act(() => result.current.selectAll());

    expect(result.current.normalizedRange).toEqual({
      rowStart: 0,
      rowEnd: 2,
      columnStart: 0,
      columnEnd: FIELDS.length - 1,
    });
  });

  test("selectRow spans the row's full width", () => {
    const { result } = renderHook(() =>
      useGridSelection({ rowIds: ["a", "b", "c"], fieldKeys: FIELDS }),
    );

    act(() => result.current.selectRow("b"));

    expect(result.current.normalizedRange).toEqual({
      rowStart: 1,
      rowEnd: 1,
      columnStart: 0,
      columnEnd: FIELDS.length - 1,
    });
    expect(result.current.hasExplicitRange).toBe(true);
  });

  test("focus follows row reorder by stable rowId (L1.1)", () => {
    const initialRows = ["a", "b", "c"];
    const { result, rerender } = renderHook(
      ({ rowIds }) => useGridSelection({ rowIds, fieldKeys: FIELDS }),
      { initialProps: { rowIds: initialRows } },
    );
    act(() => result.current.setActive({ rowId: "b", fieldKey: "name" }));
    expect(result.current.activeCell).toEqual({ rowIndex: 1, columnIndex: 1 });

    // Reorder rows so "b" is now at index 0.
    rerender({ rowIds: ["b", "a", "c"] });

    expect(result.current.activeCell).toEqual({ rowIndex: 0, columnIndex: 1 });
    expect(result.current.focus).toEqual({ rowId: "b", fieldKey: "name" });
  });

  test("selectColumn spans the column's full height", () => {
    const { result } = renderHook(() =>
      useGridSelection({ rowIds: ["a", "b", "c"], fieldKeys: FIELDS }),
    );

    act(() => result.current.selectColumn("name"));

    expect(result.current.normalizedRange).toEqual({
      rowStart: 0,
      rowEnd: 2,
      columnStart: 1,
      columnEnd: 1,
    });
    expect(result.current.anchor).toEqual({ rowId: "a", fieldKey: "name" });
    expect(result.current.focus).toEqual({ rowId: "c", fieldKey: "name" });
    expect(result.current.hasExplicitRange).toBe(true);
  });

  test("extendToColumn preserves the prior anchor and stretches to the new column", () => {
    const { result } = renderHook(() =>
      useGridSelection({ rowIds: ["a", "b", "c"], fieldKeys: FIELDS }),
    );
    act(() => result.current.selectColumn("number"));

    act(() => result.current.extendToColumn("count"));

    expect(result.current.normalizedRange).toEqual({
      rowStart: 0,
      rowEnd: 2,
      columnStart: 0,
      columnEnd: 2,
    });
    expect(result.current.anchor).toEqual({ rowId: "a", fieldKey: "number" });
    expect(result.current.focus).toEqual({ rowId: "c", fieldKey: "count" });
  });

  test("selectColumn called twice on the same column toggles off (Phase 3 R1)", () => {
    const { result } = renderHook(() =>
      useGridSelection({ rowIds: ["a", "b", "c"], fieldKeys: FIELDS }),
    );

    act(() => result.current.selectColumn("name"));
    expect(result.current.hasExplicitRange).toBe(true);
    expect(result.current.normalizedRange).toEqual({
      rowStart: 0,
      rowEnd: 2,
      columnStart: 1,
      columnEnd: 1,
    });

    act(() => result.current.selectColumn("name"));
    expect(result.current.hasExplicitRange).toBe(false);
    expect(result.current.activeCell).toEqual({ rowIndex: 0, columnIndex: 1 });
  });

  test("selectColumn on a different column replaces (does not toggle off)", () => {
    const { result } = renderHook(() =>
      useGridSelection({ rowIds: ["a", "b", "c"], fieldKeys: FIELDS }),
    );

    act(() => result.current.selectColumn("name"));
    act(() => result.current.selectColumn("count"));

    expect(result.current.hasExplicitRange).toBe(true);
    expect(result.current.normalizedRange).toEqual({
      rowStart: 0,
      rowEnd: 2,
      columnStart: 2,
      columnEnd: 2,
    });
  });

  test("extendToColumn without a prior anchor falls through to selectColumn", () => {
    const { result } = renderHook(() =>
      useGridSelection({ rowIds: ["a", "b", "c"], fieldKeys: FIELDS }),
    );

    act(() => result.current.extendToColumn("name"));

    expect(result.current.normalizedRange).toEqual({
      rowStart: 0,
      rowEnd: 2,
      columnStart: 1,
      columnEnd: 1,
    });
    expect(result.current.anchor).toEqual({ rowId: "a", fieldKey: "name" });
    expect(result.current.focus).toEqual({ rowId: "c", fieldKey: "name" });
  });

  test("focus falls back to origin when the anchored row is removed", () => {
    const { result, rerender } = renderHook(
      ({ rowIds }) => useGridSelection({ rowIds, fieldKeys: FIELDS }),
      { initialProps: { rowIds: ["a", "b", "c"] } },
    );
    act(() => result.current.setActive({ rowId: "b", fieldKey: "name" }));

    rerender({ rowIds: ["a", "c"] });

    expect(result.current.activeCell).toEqual({ rowIndex: 0, columnIndex: 0 });
  });
});
