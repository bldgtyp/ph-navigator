import { describe, expect, it } from "vitest";
import { mismatchedSides } from "../operation-frame-match";
import type { ApertureElement, FrameRef } from "../types";

function frame(operation: string | null, handEnter = false): FrameRef {
  return {
    name: "X",
    manufacturer: null,
    brand: null,
    use: null,
    operation,
    location: null,
    mull_type: null,
    prefix: null,
    suffix: null,
    material: null,
    width_mm: 50,
    u_value_w_m2k: null,
    psi_g_w_mk: null,
    psi_install_w_mk: null,
    color: null,
    source: null,
    comments: null,
    catalog_origin: handEnter
      ? null
      : {
          catalog_table: "frame_types",
          catalog_record_id: "rec00000000000ABC",
          catalog_version_id: null,
          catalog_schema_version: 1,
          synced_at: "2026-01-01T00:00:00Z",
          local_overrides: [],
        },
  };
}

function element(overrides: Partial<ApertureElement> = {}): ApertureElement {
  return {
    id: "aptel_X",
    name: "X",
    row_span: [0, 0],
    column_span: [0, 0],
    frames: { top: null, right: null, bottom: null, left: null },
    glazing: null,
    operation: null,
    ...overrides,
  };
}

describe("mismatchedSides", () => {
  it("all four sides aligned → empty", () => {
    const el = element({
      operation: { type: "swing", directions: ["left"] },
      frames: {
        top: frame("Swing (Left)"),
        right: frame("Swing (Left)"),
        bottom: frame("Swing (Left)"),
        left: frame("Swing (Left)"),
      },
    });
    expect(mismatchedSides(el)).toEqual([]);
  });

  it("element Swing+Left vs top frame Fixed → ['top']", () => {
    const el = element({
      operation: { type: "swing", directions: ["left"] },
      frames: {
        top: frame("Fixed"),
        right: frame("Swing (Left)"),
        bottom: frame("Swing (Left)"),
        left: frame("Swing (Left)"),
      },
    });
    expect(mismatchedSides(el)).toEqual(["top"]);
  });

  it("hand-entered frames are skipped", () => {
    const el = element({
      operation: { type: "swing", directions: ["left"] },
      frames: {
        top: frame("Fixed", true),
        right: frame(null),
        bottom: null,
        left: frame("Swing (Left)"),
      },
    });
    expect(mismatchedSides(el)).toEqual([]);
  });
});
