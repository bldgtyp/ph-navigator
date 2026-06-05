import { describe, expect, it } from "vitest";
import {
  blankHandEnterFrameRef,
  blankHandEnterGlazingRef,
  catalogRowToFrameRef,
  catalogRowToGlazingRef,
} from "../ref-builders";

const FRAME_ROW = {
  id: "rec000000000FRAME",
  name: "Skyline SR-3",
  manufacturer: "Skyline",
  brand: "Ridge",
  use: "Window",
  operation: "Casement",
  location: "Head",
  mull_type: null,
  prefix: null,
  suffix: "TS",
  material: "Aluminum",
  width_mm: 100,
  u_value_w_m2k: 0.85,
  psi_g_w_mk: 0.04,
  psi_install_w_mk: 0.03,
  color: "#282828",
  source: "https://example.com/sheet.pdf",
  comments: "tri-seal",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("ref-builders", () => {
  it("catalogRowToFrameRef copies fields and stamps catalog_origin", () => {
    const ref = catalogRowToFrameRef(FRAME_ROW);
    expect(ref.name).toBe("Skyline SR-3");
    expect(ref.width_mm).toBe(100);
    expect(ref.catalog_origin?.catalog_table).toBe("frame_types");
    expect(ref.catalog_origin?.catalog_record_id).toBe("rec000000000FRAME");
    expect(ref.catalog_origin?.local_overrides).toEqual([]);
  });

  it("blankHandEnterFrameRef leaves catalog_origin null and name set to Unnamed", () => {
    const ref = blankHandEnterFrameRef();
    expect(ref.catalog_origin).toBeNull();
    expect(ref.name).toBe("Unnamed");
    expect(ref.width_mm).toBeNull();
  });

  it("blankHandEnterGlazingRef mirrors the frame builder", () => {
    const ref = blankHandEnterGlazingRef();
    expect(ref.catalog_origin).toBeNull();
    expect(ref.name).toBe("Unnamed");
    expect(ref.u_value_w_m2k).toBeNull();
  });

  it("catalogRowToGlazingRef copies fields and stamps catalog_origin", () => {
    const ref = catalogRowToGlazingRef({
      id: "recGLZNG000000000",
      name: "Triple",
      manufacturer: "ABC",
      brand: null,
      suffix: null,
      u_value_w_m2k: 0.7,
      g_value: 0.5,
      color: null,
      source: null,
      comments: null,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(ref.name).toBe("Triple");
    expect(ref.g_value).toBe(0.5);
    expect(ref.catalog_origin?.catalog_table).toBe("glazing_types");
  });
});
