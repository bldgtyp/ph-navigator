import { describe, expect, it } from "vitest";
import type { ApertureTypeEntry, FrameRef, GlazingRef } from "../types";
import { inUseManufacturers, isManufacturerEnabled } from "../lib/inUseManufacturers";

function frame(manufacturer: string | null): FrameRef {
  return {
    name: "F",
    manufacturer,
    operation: null,
    location: null,
    width_mm: 80,
    u_value_w_m2k: 1,
    psi_g_w_mk: 0.04,
    psi_install_w_mk: null,
    color: null,
    source: null,
    comments: null,
    g_value: null,
    use: null,
    brand: null,
    mull_type: null,
    prefix: null,
    suffix: null,
    material: null,
    catalog_origin: null,
    local_overrides: [],
  } as unknown as FrameRef;
}

function glazing(manufacturer: string | null): GlazingRef {
  return {
    name: "G",
    manufacturer,
    u_value_w_m2k: 0.8,
    g_value: 0.5,
    color: null,
    source: null,
    comments: null,
    brand: null,
    suffix: null,
    catalog_origin: null,
    local_overrides: [],
  } as unknown as GlazingRef;
}

function aperture(opts: {
  id?: string;
  frames?: {
    top?: string | null;
    right?: string | null;
    bottom?: string | null;
    left?: string | null;
  };
  glazing?: string | null;
}): ApertureTypeEntry {
  return {
    id: opts.id ?? "apt_X",
    name: "X",
    row_heights_mm: [1000],
    column_widths_mm: [1000],
    elements: [
      {
        id: "aptel_X",
        name: "X",
        row_span: [0, 0],
        column_span: [0, 0],
        frames: {
          top: opts.frames?.top !== undefined ? frame(opts.frames.top) : null,
          right: opts.frames?.right !== undefined ? frame(opts.frames.right) : null,
          bottom: opts.frames?.bottom !== undefined ? frame(opts.frames.bottom) : null,
          left: opts.frames?.left !== undefined ? frame(opts.frames.left) : null,
        },
        glazing: opts.glazing !== undefined ? glazing(opts.glazing) : null,
        operation: null,
      },
    ],
  };
}

describe("inUseManufacturers", () => {
  it("collects distinct frame manufacturers across all sides and elements", () => {
    const apts = [
      aperture({
        frames: { top: "Schüco", right: "Schüco", bottom: "Alpen", left: "Schüco" },
      }),
      aperture({ id: "apt_Y", frames: { top: "alpen" } }),
    ];
    expect(inUseManufacturers(apts, "frame_types")).toEqual(
      ["alpen", "Schüco"].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
    );
  });

  it("ignores null / blank manufacturers", () => {
    const apts = [aperture({ frames: { top: null, right: "   " } })];
    expect(inUseManufacturers(apts, "frame_types")).toEqual([]);
  });

  it("collects glazing manufacturers separately", () => {
    const apts = [
      aperture({ frames: { top: "Schüco" }, glazing: "Alpen" }),
      aperture({ id: "apt_Y", glazing: "Internorm" }),
    ];
    expect(inUseManufacturers(apts, "glazing_types")).toEqual(["Alpen", "Internorm"]);
  });
});

describe("isManufacturerEnabled", () => {
  it("returns true when the enabled list is null (all enabled)", () => {
    expect(isManufacturerEnabled("Schüco", null)).toBe(true);
  });

  it("returns false on empty enabled list", () => {
    expect(isManufacturerEnabled("Schüco", [])).toBe(false);
  });

  it("matches case-insensitively", () => {
    expect(isManufacturerEnabled("Schüco", ["SCHÜCO"])).toBe(true);
  });
});
