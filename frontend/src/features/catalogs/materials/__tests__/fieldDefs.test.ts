import { describe, expect, test } from "vitest";
import {
  MATERIAL_CATEGORY_OPTIONS,
  MATERIALS_BUILT_IN_FIELD_DEFS,
  MATERIALS_FIELD_OVERLAY,
  materialCategoryFromOptionId,
} from "../fieldDefs";

describe("materials field defs", () => {
  test("declares the catalog fields in the PRD order", () => {
    expect(MATERIALS_BUILT_IN_FIELD_DEFS.map((f) => f.field_key)).toEqual([
      "name",
      "category",
      "density_kg_m3",
      "specific_heat_j_kgk",
      "conductivity_w_mk",
      "emissivity",
      "air_permeance_l_s_m2_at_75pa",
      "color",
      "source",
      "url",
      "comments",
    ]);
    for (const fieldDef of MATERIALS_BUILT_IN_FIELD_DEFS) {
      expect(fieldDef.origin).toBe("built_in");
    }
  });

  test("ships exactly thirteen fixed category options", () => {
    expect(MATERIAL_CATEGORY_OPTIONS).toHaveLength(13);
    expect(MATERIAL_CATEGORY_OPTIONS.map((o) => o.id)).toContain("opt_insulation");
    expect(MATERIAL_CATEGORY_OPTIONS.map((o) => o.id)).toContain("opt_doors");
    expect(MATERIAL_CATEGORY_OPTIONS.map((o) => o.id)).toContain("opt_membrane");
  });

  test("category overlay locks options + type + delete + duplicate", () => {
    expect(MATERIALS_FIELD_OVERLAY.category?.locked).toEqual([
      "field_type",
      "options",
      "delete",
      "duplicate",
    ]);
    expect(MATERIALS_FIELD_OVERLAY.category?.options).toEqual(MATERIAL_CATEGORY_OPTIONS);
  });

  test("density, specific_heat, conductivity, air_permeance carry fixed numberUnits", () => {
    for (const key of [
      "density_kg_m3",
      "specific_heat_j_kgk",
      "conductivity_w_mk",
      "air_permeance_l_s_m2_at_75pa",
    ] as const) {
      const overlay = MATERIALS_FIELD_OVERLAY[key];
      expect(overlay?.numberUnits?.mode).toBe("fixed");
    }
  });

  test("materialCategoryFromOptionId round-trips option ids and rejects unknown", () => {
    expect(materialCategoryFromOptionId("opt_insulation")).toBe("insulation");
    expect(materialCategoryFromOptionId("opt_doors")).toBe("doors");
    expect(materialCategoryFromOptionId("opt_membrane")).toBe("membrane");
    expect(materialCategoryFromOptionId("opt_bogus")).toBeNull();
    expect(materialCategoryFromOptionId(null)).toBeNull();
  });
});
