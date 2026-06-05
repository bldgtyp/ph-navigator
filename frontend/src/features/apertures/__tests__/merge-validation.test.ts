import { describe, expect, it } from "vitest";
import { topLeftSource, validateMergeSelection } from "../merge-validation";
import type { ApertureElement, ApertureTypeEntry } from "../types";

function element(
  id: string,
  rowSpan: [number, number],
  columnSpan: [number, number],
): ApertureElement {
  return {
    id,
    name: id,
    row_span: rowSpan,
    column_span: columnSpan,
    frames: { top: null, right: null, bottom: null, left: null },
    glazing: null,
    operation: null,
  };
}

function aperture(elements: ApertureElement[]): ApertureTypeEntry {
  return {
    id: "apt_X",
    name: "X",
    row_heights_mm: [1000, 1000],
    column_widths_mm: [1000, 1000],
    elements,
  };
}

describe("validateMergeSelection", () => {
  const grid = aperture([
    element("tl", [0, 0], [0, 0]),
    element("tr", [0, 0], [1, 1]),
    element("bl", [1, 1], [0, 0]),
    element("br", [1, 1], [1, 1]),
  ]);

  it("two adjacent cells form a rectangle", () => {
    const result = validateMergeSelection(grid, ["tl", "tr"]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.merged).toEqual({ row_span: [0, 0], column_span: [0, 1] });
    }
  });

  it("two diagonal cells reject as non-rectangle", () => {
    const result = validateMergeSelection(grid, ["tl", "br"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("non-rectangle");
  });

  it("three L-shape cells reject", () => {
    const result = validateMergeSelection(grid, ["tl", "tr", "bl"]);
    expect(result.ok).toBe(false);
  });

  it("all four form a 2×2 rectangle", () => {
    const result = validateMergeSelection(grid, ["tl", "tr", "bl", "br"]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.merged).toEqual({ row_span: [0, 1], column_span: [0, 1] });
    }
  });

  it("fewer than two elements rejects", () => {
    expect(validateMergeSelection(grid, ["tl"]).ok).toBe(false);
  });
});

describe("topLeftSource", () => {
  it("returns smallest (row_span[0], column_span[0])", () => {
    const a = element("a", [1, 1], [0, 0]);
    const b = element("b", [0, 0], [1, 1]);
    const c = element("c", [0, 0], [0, 0]);
    expect(topLeftSource([a, b, c]).id).toBe("c");
  });
});
