import { describe, expect, test } from "vitest";
import {
  GLAZING_TYPES_BUILT_IN_FIELD_DEFS,
  GLAZING_TYPES_FIELD_OVERLAY,
  GLAZING_TYPES_TABLE_KEY,
} from "../fieldDefs";

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

  test("u_value_w_m2k carries fixed IP/SI numberUnits", () => {
    const overlay = GLAZING_TYPES_FIELD_OVERLAY.u_value_w_m2k;
    expect(overlay?.numberUnits?.mode).toBe("fixed");
    expect(overlay?.numberUnits?.unit_type).toBe("u_value");
    expect(overlay?.numberUnits?.si_unit).toBe("w_m2_k");
    expect(overlay?.numberUnits?.ip_unit).toBe("btu_h_ft2_f");
  });

  test("g_value is dimensionless with fixed precision", () => {
    const overlay = GLAZING_TYPES_FIELD_OVERLAY.g_value;
    expect(overlay?.numberUnits).toBeUndefined();
    expect(overlay?.numberPrecision).toBe(2);
  });

  test("table key matches the backend table name", () => {
    expect(GLAZING_TYPES_TABLE_KEY).toBe("catalog_glazing_types");
  });
});
