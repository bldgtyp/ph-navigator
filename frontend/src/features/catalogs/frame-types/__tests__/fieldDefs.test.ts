import { describe, expect, test } from "vitest";
import {
  FRAME_TYPES_BUILT_IN_FIELD_DEFS,
  FRAME_TYPES_FIELD_OVERLAY,
  FRAME_TYPES_TABLE_KEY,
} from "../fieldDefs";

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

  test("width_mm carries fixed mm/in numberUnits", () => {
    const overlay = FRAME_TYPES_FIELD_OVERLAY.width_mm;
    expect(overlay?.numberUnits?.mode).toBe("fixed");
    expect(overlay?.numberUnits?.unit_type).toBe("length_mm");
    expect(overlay?.numberUnits?.si_unit).toBe("mm");
    expect(overlay?.numberUnits?.ip_unit).toBe("in");
  });

  test("u_value_w_m2k carries fixed IP/SI numberUnits", () => {
    const overlay = FRAME_TYPES_FIELD_OVERLAY.u_value_w_m2k;
    expect(overlay?.numberUnits?.mode).toBe("fixed");
    expect(overlay?.numberUnits?.unit_type).toBe("u_value");
    expect(overlay?.numberUnits?.si_unit).toBe("w_m2_k");
    expect(overlay?.numberUnits?.ip_unit).toBe("btu_h_ft2_f");
  });

  test("psi columns use the conductivity W/(m·K) ↔ Btu/(h·ft·F) pair", () => {
    for (const key of ["psi_g_w_mk", "psi_install_w_mk"] as const) {
      const overlay = FRAME_TYPES_FIELD_OVERLAY[key];
      expect(overlay?.numberUnits?.unit_type).toBe("conductivity");
      expect(overlay?.numberUnits?.si_unit).toBe("w_m_k");
      expect(overlay?.numberUnits?.ip_unit).toBe("btu_h_ft_f");
    }
  });

  test("soft-enum categorization columns stay short_text in v1 (PRD D4)", () => {
    for (const key of ["use", "operation", "location", "mull_type", "material"] as const) {
      const fieldDef = FRAME_TYPES_BUILT_IN_FIELD_DEFS.find((f) => f.field_key === key);
      expect(fieldDef?.field_type).toBe("short_text");
      expect(FRAME_TYPES_FIELD_OVERLAY[key]?.options).toBeUndefined();
    }
  });

  test("table key matches the backend table name", () => {
    expect(FRAME_TYPES_TABLE_KEY).toBe("catalog_frame_types");
  });
});
