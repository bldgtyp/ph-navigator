import { renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useGridColumns } from "../hooks/useGridColumns";
import type { DataTableColumnDef } from "../types";

type Row = { id: string; name: string; count: number; floor: string };

const COLUMNS: DataTableColumnDef<Row>[] = [
  { id: "name", fieldKey: "name", header: "Name", accessor: (r) => r.name },
  { id: "count", fieldKey: "count", header: "Count", accessor: (r) => r.count },
  { id: "floor", fieldKey: "floor", header: "Floor", accessor: (r) => r.floor },
];

const renderColumns = (columnOrder: string[], hiddenColumns: string[]) =>
  renderHook(() => useGridColumns(COLUMNS, columnOrder, hiddenColumns)).result.current;

describe("useGridColumns", () => {
  test("empty order + empty hidden → returns columns in declaration order", () => {
    const result = renderColumns([], []);
    expect(result.map((c) => c.id)).toEqual(["name", "count", "floor"]);
  });

  test("hides columns listed in hiddenColumns", () => {
    const result = renderColumns([], ["count"]);
    expect(result.map((c) => c.id)).toEqual(["name", "floor"]);
  });

  test("applies explicit columnOrder", () => {
    const result = renderColumns(["floor", "count", "name"], []);
    expect(result.map((c) => c.id)).toEqual(["floor", "count", "name"]);
  });

  test("ids missing from columnOrder append in declaration order", () => {
    const result = renderColumns(["floor"], []);
    expect(result.map((c) => c.id)).toEqual(["floor", "name", "count"]);
  });

  test("primary column (first after ordering) is never hidden", () => {
    // `name` is first in declaration order — even when listed in
    // hiddenColumns it must remain visible.
    const result = renderColumns([], ["name", "count"]);
    expect(result.map((c) => c.id)).toEqual(["name", "floor"]);
  });

  test("primary column rule respects re-ordering", () => {
    // After moving `floor` to the front, `floor` becomes the primary
    // column — and `name` is now hideable.
    const result = renderColumns(["floor", "name", "count"], ["floor", "name"]);
    expect(result.map((c) => c.id)).toEqual(["floor", "count"]);
  });

  test("ignores unknown ids in columnOrder", () => {
    const result = renderColumns(["does-not-exist", "count"], []);
    expect(result.map((c) => c.id)).toEqual(["count", "name", "floor"]);
  });

  test("duplicate ids in columnOrder are deduped", () => {
    const result = renderColumns(["count", "count", "name"], []);
    expect(result.map((c) => c.id)).toEqual(["count", "name", "floor"]);
  });

  test("memoizes when inputs are reference-stable", () => {
    const columnOrder: string[] = [];
    const hiddenColumns: string[] = [];
    const { result, rerender } = renderHook(() =>
      useGridColumns(COLUMNS, columnOrder, hiddenColumns),
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
