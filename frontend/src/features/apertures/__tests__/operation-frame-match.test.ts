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
  it("treats Swing-family frame operations as aligned with swing elements", () => {
    const el = element({
      operation: { type: "swing", directions: ["left"] },
      frames: {
        top: frame("Casement"),
        right: frame("Tilt-Turn"),
        bottom: frame("Double-Hung"),
        left: frame("Swing (Left)"),
      },
    });
    expect(mismatchedSides(el)).toEqual([]);
  });

  it("warns when a frame operation is outside the element operation family", () => {
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

  it("treats Slide-family frame operations as aligned with slide elements", () => {
    const el = element({
      operation: { type: "slide", directions: ["left"] },
      frames: {
        top: frame("Sliding"),
        right: frame("Double-Hung"),
        bottom: frame("Slide"),
        left: frame("Fixed"),
      },
    });
    expect(mismatchedSides(el)).toEqual(["left"]);
  });

  it("treats null element operation as Fixed", () => {
    const el = element({
      operation: null,
      frames: {
        top: frame("Fixed"),
        right: frame("Casement"),
        bottom: null,
        left: null,
      },
    });
    expect(mismatchedSides(el)).toEqual(["right"]);
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
