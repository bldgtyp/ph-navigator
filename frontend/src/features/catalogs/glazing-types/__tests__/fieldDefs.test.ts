import { describe, expect, test } from "vitest";
import {
  buildGlazingTypesFieldOverlay,
  GLAZING_TYPES_BUILT_IN_FIELD_DEFS,
  GLAZING_TYPES_SINGLE_SELECT_FIELDS,
  GLAZING_TYPES_TABLE_KEY,
} from "../fieldDefs";

const OVERLAY = buildGlazingTypesFieldOverlay({
  manufacturer: [{ id: "opt_kawneer", label: "Kawneer", color: "#3b82f6", order: 0 }],
});

describe("glazing-types field defs", () => {
  test("declares the nine catalog fields in PRD order", () => {
    expect(GLAZING_TYPES_BUILT_IN_FIELD_DEFS.map((f) => f.field_key)).toEqual([
      "name",
      "manufacturer",
      "brand",
      "suffix",
      "u_value_w_m2k",
      "g_value",
      "color",
      "source",
      "comments",
    ]);
    for (const fieldDef of GLAZING_TYPES_BUILT_IN_FIELD_DEFS) {
      expect(fieldDef.origin).toBe("built_in");
    }
  });

  test("manufacturer is the only single_select field", () => {
    expect([...GLAZING_TYPES_SINGLE_SELECT_FIELDS]).toEqual(["manufacturer"]);
    for (const key of GLAZING_TYPES_SINGLE_SELECT_FIELDS) {
      const fieldDef = GLAZING_TYPES_BUILT_IN_FIELD_DEFS.find((f) => f.field_key === key);
      expect(fieldDef?.field_type).toBe("single_select");
    }
  });

  test("name is read-only (server-derived); brand + suffix stay free text", () => {
    expect(GLAZING_TYPES_BUILT_IN_FIELD_DEFS.find((f) => f.field_key === "name")?.field_type).toBe(
      "short_text",
    );
    expect(OVERLAY.name?.read_only).toBe(true);
    expect(GLAZING_TYPES_BUILT_IN_FIELD_DEFS.find((f) => f.field_key === "brand")?.field_type).toBe(
      "short_text",
    );
    expect(
      GLAZING_TYPES_BUILT_IN_FIELD_DEFS.find((f) => f.field_key === "suffix")?.field_type,
    ).toBe("short_text");
  });

  test("overlay injects fetched options on manufacturer; brand has no options list", () => {
    expect(OVERLAY.manufacturer?.options?.map((o) => o.label)).toEqual(["Kawneer"]);
    // `options` is NOT locked — the field-config manage-options path edits the
    // catalog store. `field_type` stays locked (fixed built-ins).
    expect(OVERLAY.manufacturer?.locked).not.toContain("options");
    expect(OVERLAY.manufacturer?.locked).toContain("field_type");
    expect(OVERLAY.manufacturer?.locked).toContain("display_name");
    expect(OVERLAY.manufacturer?.locked).toContain("description");
    // `brand` is free text — a static overlay entry with no options list.
    expect(OVERLAY.brand?.options).toBeUndefined();
  });

  test("u_value_w_m2k carries fixed IP/SI numberUnits", () => {
    const overlay = OVERLAY.u_value_w_m2k;
    expect(overlay?.numberUnits?.mode).toBe("fixed");
    expect(overlay?.numberUnits?.unit_type).toBe("u_value");
    expect(overlay?.numberUnits?.si_unit).toBe("w_m2_k");
    expect(overlay?.numberUnits?.ip_unit).toBe("btu_h_ft2_f");
  });

  test("g_value is dimensionless with fixed precision", () => {
    const overlay = OVERLAY.g_value;
    expect(overlay?.numberUnits).toBeUndefined();
    expect(overlay?.numberPrecision).toBe(2);
  });

  test("table key matches the backend table name", () => {
    expect(GLAZING_TYPES_TABLE_KEY).toBe("catalog_glazing_types");
  });
});
