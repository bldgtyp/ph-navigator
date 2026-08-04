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
    kind: "glazed",
    row_span: rowSpan,
    column_span: columnSpan,
    frames: { top: null, right: null, bottom: null, left: null },
    installs: { top: null, right: null, bottom: null, left: null },
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

  it("rejects a rectangular mixed Glazed and Empty selection", () => {
    const mixed = aperture([
      element("glazed", [0, 0], [0, 0]),
      { ...element("void", [0, 0], [1, 1]), kind: "void" },
    ]);
    const result = validateMergeSelection(mixed, ["glazed", "void"]);

    expect(result).toMatchObject({
      ok: false,
      reason: "mixed-kind",
      message: "Glazed and Empty elements cannot be merged together.",
    });
  });

  it("allows adjacent Empty elements to merge", () => {
    const empty = aperture([
      { ...element("left", [0, 0], [0, 0]), kind: "void" },
      { ...element("right", [0, 0], [1, 1]), kind: "void" },
    ]);

    expect(validateMergeSelection(empty, ["left", "right"]).ok).toBe(true);
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
