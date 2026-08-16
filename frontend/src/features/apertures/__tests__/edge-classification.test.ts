// Paired with backend/tests/test_aperture_edge_classification.py — the
// case tables below are copied verbatim from that suite (1×1, 1×2 mull,
// 2×2, span adjacency, void neighbour, L-shaped mixed adjacency). Keep
// the two files in lockstep when the classification rule changes.
import { describe, expect, test } from "vitest";
import { classifyElementEdges, edgeClassKey } from "../edge-classification";
import { APERTURE_SIDES, type ApertureElement, type ApertureTypeEntry } from "../types";
import { apertureElement, apertureEntry } from "./aperture-ui-test-fixtures";

describe("classifyElementEdges (mirror of backend classifier)", () => {
  test("single element is perimeter on all sides", () => {
    const classes = classifyElementEdges(
      entry([1000], [800], [element("aptel_a", [0, 0], [0, 0])]),
    );
    expect(sides(classes, "aptel_a")).toEqual({
      top: "perimeter",
      right: "perimeter",
      bottom: "perimeter",
      left: "perimeter",
    });
  });

  test("side-by-side mull is interior on the shared edge", () => {
    const classes = classifyElementEdges(
      entry(
        [1000],
        [800, 800],
        [element("aptel_l", [0, 0], [0, 0]), element("aptel_r", [0, 0], [1, 1])],
      ),
    );
    expect(sides(classes, "aptel_l").right).toBe("interior");
    expect(sides(classes, "aptel_l").left).toBe("perimeter");
    expect(sides(classes, "aptel_r").left).toBe("interior");
  });

  test("2x2 grid gives each element two interior sides", () => {
    const classes = classifyElementEdges(
      entry(
        [600, 600],
        [800, 800],
        [
          element("aptel_tl", [0, 0], [0, 0]),
          element("aptel_tr", [0, 0], [1, 1]),
          element("aptel_bl", [1, 1], [0, 0]),
          element("aptel_br", [1, 1], [1, 1]),
        ],
      ),
    );
    expect(sides(classes, "aptel_tl")).toEqual({
      top: "perimeter",
      right: "interior",
      bottom: "interior",
      left: "perimeter",
    });
    expect(sides(classes, "aptel_br")).toEqual({
      top: "interior",
      right: "perimeter",
      bottom: "perimeter",
      left: "interior",
    });
  });

  test("spanning element beside two singles is interior across the full edge", () => {
    const classes = classifyElementEdges(
      entry(
        [600, 600],
        [800, 800],
        [
          element("aptel_span", [0, 1], [0, 0]),
          element("aptel_top", [0, 0], [1, 1]),
          element("aptel_bottom", [1, 1], [1, 1]),
        ],
      ),
    );
    expect(sides(classes, "aptel_span").right).toBe("interior");
    expect(sides(classes, "aptel_top").left).toBe("interior");
    expect(sides(classes, "aptel_bottom").left).toBe("interior");
  });

  test("void neighbour counts as perimeter; void sides classify perimeter", () => {
    const classes = classifyElementEdges(
      entry(
        [1000],
        [800, 800],
        [element("aptel_glazed", [0, 0], [0, 0]), element("aptel_void", [0, 0], [1, 1], "void")],
      ),
    );
    expect(sides(classes, "aptel_glazed").right).toBe("perimeter");
    expect(sides(classes, "aptel_void")).toEqual({
      top: "perimeter",
      right: "perimeter",
      bottom: "perimeter",
      left: "perimeter",
    });
  });

  test("L-shaped mixed glazed/void adjacency is perimeter", () => {
    const classes = classifyElementEdges(
      entry(
        [600, 600],
        [800, 800],
        [
          element("aptel_span", [0, 1], [0, 0]),
          element("aptel_glazed", [0, 0], [1, 1]),
          element("aptel_void", [1, 1], [1, 1], "void"),
        ],
      ),
    );
    expect(sides(classes, "aptel_span").right).toBe("perimeter");
    expect(sides(classes, "aptel_glazed").left).toBe("interior");
    expect(sides(classes, "aptel_void").left).toBe("perimeter");
  });
});

function entry(
  rowHeights: number[],
  columnWidths: number[],
  elements: ApertureElement[],
): ApertureTypeEntry {
  return apertureEntry({ row_heights_mm: rowHeights, column_widths_mm: columnWidths, elements });
}

function element(
  id: string,
  rowSpan: [number, number],
  columnSpan: [number, number],
  kind: "glazed" | "void" = "glazed",
): ApertureElement {
  return apertureElement({ id, name: id, kind, row_span: rowSpan, column_span: columnSpan });
}

function sides(classes: Map<string, string>, elementId: string): Record<string, string> {
  return Object.fromEntries(
    APERTURE_SIDES.map((side) => [side, classes.get(edgeClassKey(elementId, side)) ?? "missing"]),
  );
}
