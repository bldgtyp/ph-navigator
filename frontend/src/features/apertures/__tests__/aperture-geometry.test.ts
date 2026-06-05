import { describe, expect, it } from "vitest";
import {
  columnXOffsetMm,
  elementRectMm,
  elementRegionsMm,
  flipColumnForInterior,
  rowYOffsetMm,
  totalApertureHeightMm,
  totalApertureWidthMm,
  viewBoxFor,
} from "../aperture-geometry";
import type { ApertureElement, ApertureTypeEntry, FrameRef, GlazingRef } from "../types";

function frame(widthMm: number, name = "F"): FrameRef {
  return {
    name,
    manufacturer: null,
    brand: null,
    use: null,
    operation: null,
    location: null,
    mull_type: null,
    prefix: null,
    suffix: null,
    material: null,
    width_mm: widthMm,
    u_value_w_m2k: null,
    psi_g_w_mk: null,
    psi_install_w_mk: null,
    color: null,
    source: null,
    comments: null,
    catalog_origin: null,
  };
}

function glazing(): GlazingRef {
  return {
    name: "G",
    manufacturer: null,
    brand: null,
    suffix: null,
    u_value_w_m2k: null,
    g_value: null,
    color: null,
    source: null,
    comments: null,
    catalog_origin: null,
  };
}

function element(overrides: Partial<ApertureElement>): ApertureElement {
  return {
    id: "aptel_1",
    name: "E",
    row_span: [0, 0],
    column_span: [0, 0],
    frames: { top: null, right: null, bottom: null, left: null },
    glazing: glazing(),
    operation: null,
    ...overrides,
  };
}

function entry(overrides: Partial<ApertureTypeEntry>): ApertureTypeEntry {
  return {
    id: "apt_1",
    name: "A",
    row_heights_mm: [1000],
    column_widths_mm: [1000],
    elements: [element({})],
    ...overrides,
  };
}

describe("totals and offsets", () => {
  it("sums widths and heights", () => {
    const e = entry({ column_widths_mm: [100, 200, 300], row_heights_mm: [400, 500] });
    expect(totalApertureWidthMm(e)).toBe(600);
    expect(totalApertureHeightMm(e)).toBe(900);
  });

  it("columnXOffsetMm starts at 0 and accumulates", () => {
    const e = entry({ column_widths_mm: [100, 200, 300] });
    expect(columnXOffsetMm(e, 0)).toBe(0);
    expect(columnXOffsetMm(e, 1)).toBe(100);
    expect(columnXOffsetMm(e, 3)).toBe(600);
  });

  it("rowYOffsetMm starts at 0 and accumulates", () => {
    const e = entry({ row_heights_mm: [400, 500] });
    expect(rowYOffsetMm(e, 0)).toBe(0);
    expect(rowYOffsetMm(e, 1)).toBe(400);
    expect(rowYOffsetMm(e, 2)).toBe(900);
  });
});

describe("elementRectMm", () => {
  it("computes a single-cell rect", () => {
    const e = entry({ column_widths_mm: [500], row_heights_mm: [400] });
    const rect = elementRectMm(e, e.elements[0]!);
    expect(rect).toEqual({ x: 0, y: 0, width: 500, height: 400 });
  });

  it("spans across merged cells in a 2x2 grid", () => {
    const merged = element({ id: "aptel_m", column_span: [0, 1], row_span: [0, 0] });
    const e = entry({
      column_widths_mm: [300, 400],
      row_heights_mm: [500, 600],
      elements: [merged],
    });
    const rect = elementRectMm(e, merged);
    expect(rect).toEqual({ x: 0, y: 0, width: 700, height: 500 });
  });
});

describe("elementRegionsMm", () => {
  it("tiles the rect with no gaps or overlaps when all frames are set", () => {
    const el = element({
      frames: {
        top: frame(50),
        right: frame(60),
        bottom: frame(70),
        left: frame(80),
      },
    });
    const rect = { x: 10, y: 20, width: 500, height: 400 };
    const r = elementRegionsMm(el, rect);
    // Top spans full width at the top.
    expect(r.top).toEqual({ x: 10, y: 20, width: 500, height: 50 });
    // Bottom anchored to bottom edge.
    expect(r.bottom).toEqual({ x: 10, y: 20 + 400 - 70, width: 500, height: 70 });
    // Left/right sit between top and bottom.
    expect(r.left).toEqual({ x: 10, y: 70, width: 80, height: 400 - 50 - 70 });
    expect(r.right).toEqual({
      x: 10 + 500 - 60,
      y: 70,
      width: 60,
      height: 400 - 50 - 70,
    });
    // Glazing fills the remaining inner rect.
    expect(r.glazing).toEqual({
      x: 10 + 80,
      y: 70,
      width: 500 - 80 - 60,
      height: 400 - 50 - 70,
    });
    // Inner edges meet exactly.
    expect(r.glazing.x).toBe(r.left.x + r.left.width);
    expect(r.glazing.x + r.glazing.width).toBe(r.right.x);
  });

  it("collapses a side to zero when its frame is null and extends glazing", () => {
    const el = element({
      frames: {
        top: null,
        right: frame(60),
        bottom: frame(70),
        left: frame(80),
      },
    });
    const rect = { x: 0, y: 0, width: 500, height: 400 };
    const r = elementRegionsMm(el, rect);
    expect(r.top.height).toBe(0);
    expect(r.glazing.y).toBe(0);
    expect(r.glazing.height).toBe(400 - 70);
  });

  it("returns the full rect as glazing when all frames are null", () => {
    const el = element({});
    const rect = { x: 0, y: 0, width: 500, height: 400 };
    const r = elementRegionsMm(el, rect);
    expect(r.glazing).toEqual(rect);
  });
});

describe("viewBoxFor", () => {
  it("floors width and height at 1 to avoid degenerate viewBox", () => {
    const e = entry({ column_widths_mm: [], row_heights_mm: [] });
    expect(viewBoxFor(e)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it("uses the document totals when non-zero", () => {
    const e = entry({ column_widths_mm: [1000, 2000], row_heights_mm: [1500] });
    expect(viewBoxFor(e)).toEqual({ x: 0, y: 0, width: 3000, height: 1500 });
  });
});

describe("flipColumnForInterior", () => {
  it("leaves a single-column aperture span unchanged", () => {
    const el = element({ column_span: [0, 0] });
    const e = entry({ column_widths_mm: [1000], elements: [el] });
    const flipped = flipColumnForInterior(e, el);
    expect(flipped.column_span).toEqual([0, 0]);
  });

  it("mirrors a span and swaps left/right frame refs in a 3-column aperture", () => {
    const leftFrame = frame(40, "L");
    const rightFrame = frame(60, "R");
    const el = element({
      column_span: [0, 1],
      frames: { top: null, bottom: null, left: leftFrame, right: rightFrame },
    });
    const e = entry({ column_widths_mm: [100, 200, 300], elements: [el] });
    const flipped = flipColumnForInterior(e, el);
    expect(flipped.column_span).toEqual([1, 2]);
    expect(flipped.frames.left).toBe(rightFrame);
    expect(flipped.frames.right).toBe(leftFrame);
  });
});
