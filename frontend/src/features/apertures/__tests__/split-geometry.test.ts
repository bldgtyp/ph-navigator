import { describe, expect, it } from "vitest";
import { isSplittable, splitCells } from "../split-geometry";
import type { ApertureElement } from "../types";

function element(row: [number, number], col: [number, number]): ApertureElement {
  return {
    id: "aptel_X",
    name: "X",
    row_span: row,
    column_span: col,
    frames: { top: null, right: null, bottom: null, left: null },
    glazing: null,
    operation: null,
  };
}

describe("isSplittable", () => {
  it("1×1 cells are not splittable", () => {
    expect(isSplittable(element([0, 0], [0, 0]))).toBe(false);
  });

  it("multi-cell spans are splittable", () => {
    expect(isSplittable(element([0, 1], [0, 0]))).toBe(true);
    expect(isSplittable(element([0, 0], [0, 2]))).toBe(true);
  });
});

describe("splitCells", () => {
  it("2×2 → 4 cells", () => {
    const cells = splitCells(element([0, 1], [0, 1]));
    expect(cells).toHaveLength(4);
    expect(cells).toEqual(
      expect.arrayContaining([
        { row: 0, column: 0 },
        { row: 0, column: 1 },
        { row: 1, column: 0 },
        { row: 1, column: 1 },
      ]),
    );
  });

  it("1×3 → 3 cells in column order", () => {
    const cells = splitCells(element([0, 0], [0, 2]));
    expect(cells).toEqual([
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 0, column: 2 },
    ]);
  });
});
