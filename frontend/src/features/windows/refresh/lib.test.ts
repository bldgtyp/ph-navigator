import { describe, expect, test } from "vitest";
import type { FrameRef } from "../types";
import { applyRefreshSelection, canApplyRefresh, defaultRefreshSelection } from "./lib";
import type { RefreshSlotReport } from "./types";

const frameRef: FrameRef = {
  name: "Old frame",
  manufacturer: "Skyline",
  brand: "SR",
  width_mm: 80,
  u_value_w_m2k: 0.85,
  psi_g_w_mk: 0.04,
  psi_install_w_mk: 0.05,
  color: null,
  notes: null,
  source_provenance: null,
  catalog_origin: {
    catalog_table: "frame_types",
    catalog_record_id: "rec1234567890ab",
    catalog_version_id: "framev_old",
    catalog_schema_version: 1,
    synced_at: "2026-05-14T00:00:00.000Z",
    local_overrides: ["u_value_w_m2k"],
  },
};

function driftSlot(overrides: string[] = ["u_value_w_m2k"]): RefreshSlotReport {
  return {
    window_type_id: "win_1",
    element_id: "winel_1",
    slot: "frame.top",
    state: "drifted",
    catalog_table: "frame_types",
    catalog_record_id: "rec1234567890ab",
    pinned_catalog_version_id: "framev_old",
    current_catalog_version_id: "framev_new",
    local_overrides: overrides,
    fields: [
      {
        key: "name",
        ref_value: "Old frame",
        catalog_value: "New frame",
        is_overridden: false,
      },
      {
        key: "u_value_w_m2k",
        ref_value: 0.85,
        catalog_value: 0.95,
        is_overridden: true,
      },
      {
        key: "width_mm",
        ref_value: 80,
        catalog_value: 80,
        is_overridden: false,
      },
    ],
  };
}

describe("window refresh lib", () => {
  test("default selection updates changed non-overridden fields only", () => {
    expect(defaultRefreshSelection(driftSlot())).toEqual({
      name: "update",
      u_value_w_m2k: "keep",
      width_mm: "keep",
    });
  });

  test("applyRefreshSelection merges chosen catalog fields and preserves overrides", () => {
    const next = applyRefreshSelection(
      frameRef,
      driftSlot(),
      { name: "update", u_value_w_m2k: "keep", width_mm: "keep" },
      "2026-05-14T12:00:00.000Z",
    );

    expect(next.name).toBe("New frame");
    expect(next.u_value_w_m2k).toBe(0.85);
    expect(next.catalog_origin?.catalog_version_id).toBe("framev_new");
    expect(next.catalog_origin?.synced_at).toBe("2026-05-14T12:00:00.000Z");
    expect(next.catalog_origin?.local_overrides).toEqual(["u_value_w_m2k"]);
  });

  test("skipped fields are neither selected nor applied", () => {
    const slot = {
      ...driftSlot([]),
      fields: [
        {
          key: "name",
          ref_value: "Old frame",
          catalog_value: "New frame",
          is_overridden: false,
          skip_reason: "field_type_changed" as const,
        },
        {
          key: "brand",
          ref_value: "SR",
          catalog_value: "SRX",
          is_overridden: false,
        },
      ],
    };

    expect(defaultRefreshSelection(slot)).toEqual({
      name: "keep",
      brand: "update",
    });
    expect(canApplyRefresh(slot)).toBe(true);

    const next = applyRefreshSelection(
      frameRef,
      slot,
      { name: "update", brand: "update" },
      "2026-05-14T12:00:00.000Z",
    );

    expect(next.name).toBe("Old frame");
    expect(next.brand).toBe("SRX");
  });

  test("all-skipped drift slots cannot be applied", () => {
    const slot = {
      ...driftSlot([]),
      fields: driftSlot([]).fields.map((field) => ({
        ...field,
        skip_reason: "field_type_changed" as const,
      })),
    };

    expect(defaultRefreshSelection(slot)).toEqual({
      name: "keep",
      u_value_w_m2k: "keep",
      width_mm: "keep",
    });
    expect(canApplyRefresh(slot)).toBe(false);
  });

  test("source_deactivated slots do not mutate the ref", () => {
    const slot = {
      ...driftSlot(),
      state: "source_deactivated" as const,
      current_catalog_version_id: null,
    };
    expect(applyRefreshSelection(frameRef, slot, { name: "update" })).toBe(frameRef);
  });
});
