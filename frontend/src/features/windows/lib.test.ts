import { describe, expect, test } from "vitest";
import type { CatalogFrameType, CatalogGlazingType } from "../catalogs/types";
import {
  OVERRIDE_TRACKER_FIELD,
  frameRefFromCatalog,
  glazingRefFromCatalog,
  naturalSortByName,
  newWindowType,
  trackLocalOverride,
  uniqueWindowTypeName,
} from "./lib";
import type { WindowTypeEntry } from "./types";

const sampleFrame: CatalogFrameType = {
  id: "rec1234567890abcd",
  name: "Skyline SR-3",
  color: null,
  source: null,
  comments: null,
  is_active: true,
  created_at: "2026-05-14T00:00:00Z",
  updated_at: "2026-05-14T00:00:00Z",
  manufacturer: "Skyline",
  brand: "SR",
  use: null,
  operation: null,
  location: null,
  mull_type: null,
  prefix: null,
  suffix: null,
  material: null,
  width_mm: 80,
  u_value_w_m2k: 0.95,
  psi_g_w_mk: 0.04,
  psi_install_w_mk: 0.05,
};

const sampleGlazing: CatalogGlazingType = {
  id: "rec0000000000abcd",
  name: "Triple LowE Argon",
  color: null,
  source: null,
  comments: null,
  is_active: true,
  created_at: "2026-05-14T00:00:00Z",
  updated_at: "2026-05-14T00:00:00Z",
  manufacturer: null,
  brand: null,
  suffix: null,
  u_value_w_m2k: 0.6,
  g_value: 0.5,
};

describe("windows lib", () => {
  test("naturalSortByName sorts numerically", () => {
    const items = [{ name: "Type 10" }, { name: "Type 2" }, { name: "Type 1" }];
    expect(naturalSortByName(items).map((entry) => entry.name)).toEqual([
      "Type 1",
      "Type 2",
      "Type 10",
    ]);
  });

  test("uniqueWindowTypeName auto-suffixes duplicates case-insensitively", () => {
    const existing: WindowTypeEntry[] = [
      { id: "win_a", name: "Test", row_heights_mm: [1], column_widths_mm: [1], elements: [] },
      { id: "win_b", name: "test 2", row_heights_mm: [1], column_widths_mm: [1], elements: [] },
    ];
    expect(uniqueWindowTypeName("Test", existing)).toBe("Test (2)");
    expect(uniqueWindowTypeName("Fresh", existing)).toBe("Fresh");
  });

  test("uniqueWindowTypeName falls back to the US-WIN-1 §8 default for empty input", () => {
    expect(uniqueWindowTypeName("", [])).toBe("Unnamed Window Type");
  });

  test("newWindowType creates 1x1 element with all-null slots", () => {
    const entry = newWindowType([]);
    expect(entry.row_heights_mm).toHaveLength(1);
    expect(entry.column_widths_mm).toHaveLength(1);
    expect(entry.elements).toHaveLength(1);
    const element = entry.elements[0]!;
    expect(element.row_span).toEqual([0, 0]);
    expect(element.column_span).toEqual([0, 0]);
    expect(element.frames).toEqual({ top: null, right: null, bottom: null, left: null });
    expect(element.glazing).toBeNull();
  });

  test("frameRefFromCatalog stamps catalog_origin with empty local_overrides", () => {
    const ref = frameRefFromCatalog(sampleFrame);
    expect(ref.u_value_w_m2k).toBe(0.95);
    expect(ref.catalog_origin).not.toBeNull();
    expect(ref.catalog_origin?.catalog_table).toBe("frame_types");
    expect(ref.catalog_origin?.catalog_record_id).toBe(sampleFrame.id);
    expect(ref.catalog_origin?.catalog_version_id).toBeNull();
    expect(ref.catalog_origin?.local_overrides).toEqual([]);
  });

  test("glazingRefFromCatalog stamps glazing origin", () => {
    const ref = glazingRefFromCatalog(sampleGlazing);
    expect(ref.g_value).toBe(0.5);
    expect(ref.catalog_origin?.catalog_table).toBe("glazing_types");
    expect(ref.catalog_origin?.catalog_version_id).toBeNull();
    expect(ref.catalog_origin?.local_overrides).toEqual([]);
  });

  test("trackLocalOverride adds field once even after editing back to catalog value", () => {
    const ref = frameRefFromCatalog(sampleFrame);
    const overridden = trackLocalOverride({ ...ref, u_value_w_m2k: 1.2 }, OVERRIDE_TRACKER_FIELD);
    expect(overridden.catalog_origin?.local_overrides).toEqual([OVERRIDE_TRACKER_FIELD]);
    const overriddenAgain = trackLocalOverride(
      { ...overridden, u_value_w_m2k: sampleFrame.u_value_w_m2k },
      OVERRIDE_TRACKER_FIELD,
    );
    expect(overriddenAgain.catalog_origin?.local_overrides).toEqual([OVERRIDE_TRACKER_FIELD]);
  });

  test("trackLocalOverride no-ops on hand-entered refs", () => {
    const ref = { ...frameRefFromCatalog(sampleFrame), catalog_origin: null };
    const next = trackLocalOverride(ref, OVERRIDE_TRACKER_FIELD);
    expect(next.catalog_origin).toBeNull();
  });
});
