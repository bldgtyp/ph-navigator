import { describe, expect, test } from "vitest";
import {
  buildFrameTypesFieldOverlay,
  FRAME_TYPES_BUILT_IN_FIELD_DEFS,
  FRAME_TYPES_SINGLE_SELECT_FIELDS,
  FRAME_TYPES_TABLE_KEY,
} from "../fieldDefs";

const OVERLAY = buildFrameTypesFieldOverlay({
  manufacturer: [{ id: "opt_alpen", label: "Alpen", color: "#3b82f6", order: 0 }],
});

describe("frame-types field defs", () => {
  test("declares the seventeen catalog fields in PRD order", () => {
    expect(FRAME_TYPES_BUILT_IN_FIELD_DEFS.map((f) => f.field_key)).toEqual([
      "name",
      "manufacturer",
      "brand",
      "use",
      "operation",
      "location",
      "mull_type",
      "prefix",
      "suffix",
      "material",
      "width_mm",
      "u_value_w_m2k",
      "psi_g_w_mk",
      "psi_install_w_mk",
      "color",
      "source",
      "comments",
    ]);
    for (const fieldDef of FRAME_TYPES_BUILT_IN_FIELD_DEFS) {
      expect(fieldDef.origin).toBe("built_in");
    }
  });

  test("the six categorization columns are single_select", () => {
    for (const key of FRAME_TYPES_SINGLE_SELECT_FIELDS) {
      const fieldDef = FRAME_TYPES_BUILT_IN_FIELD_DEFS.find((f) => f.field_key === key);
      expect(fieldDef?.field_type).toBe("single_select");
    }
  });

  test("name is read-only (server-derived); material stays free text", () => {
    expect(FRAME_TYPES_BUILT_IN_FIELD_DEFS.find((f) => f.field_key === "name")?.field_type).toBe(
      "short_text",
    );
    expect(OVERLAY.name?.read_only).toBe(true);
    expect(
      FRAME_TYPES_BUILT_IN_FIELD_DEFS.find((f) => f.field_key === "material")?.field_type,
    ).toBe("short_text");
  });

  test("overlay injects fetched options; options attribute is editable (Phase 5b)", () => {
    expect(OVERLAY.manufacturer?.options?.map((o) => o.label)).toEqual(["Alpen"]);
    // `options` is NOT locked — the field-config manage-options path edits the
    // catalog store. `field_type` stays locked (fixed built-ins).
    expect(OVERLAY.manufacturer?.locked).not.toContain("options");
    expect(OVERLAY.manufacturer?.locked).toContain("field_type");
    // A field with no fetched options still gets an (empty) list, not undefined.
    expect(OVERLAY.brand?.options).toEqual([]);
  });

  test("width_mm carries fixed mm/in numberUnits", () => {
    const overlay = OVERLAY.width_mm;
    expect(overlay?.numberUnits?.mode).toBe("fixed");
    expect(overlay?.numberUnits?.unit_type).toBe("length_mm");
    expect(overlay?.numberUnits?.si_unit).toBe("mm");
    expect(overlay?.numberUnits?.ip_unit).toBe("in");
  });

  test("u_value_w_m2k carries fixed IP/SI numberUnits", () => {
    const overlay = OVERLAY.u_value_w_m2k;
    expect(overlay?.numberUnits?.mode).toBe("fixed");
    expect(overlay?.numberUnits?.unit_type).toBe("u_value");
    expect(overlay?.numberUnits?.si_unit).toBe("w_m2_k");
    expect(overlay?.numberUnits?.ip_unit).toBe("btu_h_ft2_f");
  });

  test("psi columns use the conductivity W/(m·K) ↔ Btu/(h·ft·F) pair", () => {
    for (const key of ["psi_g_w_mk", "psi_install_w_mk"] as const) {
      const overlay = OVERLAY[key];
      expect(overlay?.numberUnits?.unit_type).toBe("conductivity");
      expect(overlay?.numberUnits?.si_unit).toBe("w_m_k");
      expect(overlay?.numberUnits?.ip_unit).toBe("btu_h_ft_f");
    }
  });

  test("table key matches the backend table name", () => {
    expect(FRAME_TYPES_TABLE_KEY).toBe("catalog_frame_types");
  });
});
