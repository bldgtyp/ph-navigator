import { describe, expect, test } from "vitest";
import { buildAssemblyCanvasGeometry } from "../canvas-geometry";
import { materialById } from "../lib";
import { MEMBRANE_DISPLAY_THICKNESS_MM, MEMBRANE_MIN_HIT_HEIGHT_PX } from "../canvas-constants";
import { canvasHitBox } from "../canvas-hit-box";
import { isMembraneLayer, isMembraneMaterial } from "../membranes";
import type { Assembly, AssemblyLayer, ProjectMaterial } from "../types";

function material(overrides: Partial<ProjectMaterial> = {}): ProjectMaterial {
  return {
    id: "pmat_insul",
    name: "Mineral wool",
    category: "insulation",
    density_kg_m3: 30,
    specific_heat_j_kgk: 1030,
    conductivity_w_mk: 0.04,
    emissivity: 0.9,
    air_permeance_l_s_m2_at_75pa: null,
    color: "#dce6f0",
    source: null,
    url: null,
    comments: null,
    specification_status: "needed",
    datasheet_asset_ids: [],
    catalog_origin: null,
    use_sites: [],
    ...overrides,
  };
}

function layer(id: string, thicknessMm: number, materialIds: (string | null)[]): AssemblyLayer {
  return {
    id,
    order: 0,
    thickness_mm: thicknessMm,
    segments: materialIds.map((projectMaterialId, index) => ({
      id: `${id}-seg-${index}`,
      order: index,
      width_mm: 1000 / materialIds.length,
      is_continuous_insulation: false,
      steel_stud_spacing_mm: null,
      project_material_id: projectMaterialId,
      photo_asset_ids: [],
      use_site_notes: null,
    })),
  };
}

function assembly(layers: AssemblyLayer[]): Assembly {
  return {
    id: "asm_test",
    name: "TEST",
    type: "wall",
    orientation: "first_layer_outside",
    status: { is_complete: true, flags: [] },
    layers: layers.map((entry, index) => ({ ...entry, order: index })),
  };
}

const WRB = material({
  id: "pmat_wrb",
  name: "WRB",
  category: "membrane",
  conductivity_w_mk: null,
});

describe("isMembraneMaterial", () => {
  test("matches the category regardless of casing or padding", () => {
    for (const category of ["membrane", "Membrane", " MEMBRANE "]) {
      expect(isMembraneMaterial(material({ category }))).toBe(true);
    }
  });

  test("rejects other categories, null, and undefined", () => {
    expect(isMembraneMaterial(material({ category: "insulation" }))).toBe(false);
    expect(isMembraneMaterial(null)).toBe(false);
    expect(isMembraneMaterial(undefined)).toBe(false);
  });
});

describe("isMembraneLayer", () => {
  const byId = materialById([material(), WRB]);

  test("a single membrane segment makes a membrane layer", () => {
    expect(isMembraneLayer(layer("lyr", 0.15, ["pmat_wrb"]), byId)).toBe(true);
  });

  test("a layer mixing a membrane with a real material is not one", () => {
    // Otherwise the real material's R would be silently dropped.
    expect(isMembraneLayer(layer("lyr", 140, ["pmat_wrb", "pmat_insul"]), byId)).toBe(false);
  });

  test("an unassigned layer is incomplete, not a membrane", () => {
    expect(isMembraneLayer(layer("lyr", 140, [null]), byId)).toBe(false);
  });
});

describe("buildAssemblyCanvasGeometry", () => {
  const byId = materialById([material(), WRB]);

  test("draws a membrane at the nominal hairline, not its real thickness", () => {
    const geometry = buildAssemblyCanvasGeometry(
      assembly([layer("lyr_wrb", 0.15, ["pmat_wrb"])]),
      byId,
    );

    const [membrane] = geometry.layers;
    expect(membrane?.isMembrane).toBe(true);
    expect(membrane?.heightMm).toBe(MEMBRANE_DISPLAY_THICKNESS_MM);
    // The real value is untouched on the model — it is what the dimension
    // column and Total Thickness report.
    expect(membrane?.layer.thickness_mm).toBe(0.15);
  });

  test("stacks following layers below the drawn hairline, so nothing overlaps", () => {
    const geometry = buildAssemblyCanvasGeometry(
      assembly([layer("lyr_wrb", 0.15, ["pmat_wrb"]), layer("lyr_insul", 140, ["pmat_insul"])]),
      byId,
    );

    expect(geometry.layers[1]?.yMm).toBe(MEMBRANE_DISPLAY_THICKNESS_MM);
    expect(geometry.heightMm).toBe(MEMBRANE_DISPLAY_THICKNESS_MM + 140);
    expect(geometry.segments[1]?.yMm).toBe(MEMBRANE_DISPLAY_THICKNESS_MM);
  });

  test("ordinary layers still draw 1:1", () => {
    const geometry = buildAssemblyCanvasGeometry(
      assembly([layer("lyr_insul", 140, ["pmat_insul"])]),
      byId,
    );

    expect(geometry.layers[0]?.isMembrane).toBe(false);
    expect(geometry.layers[0]?.heightMm).toBe(140);
  });
});

describe("canvasHitBox", () => {
  const byId = materialById([material(), WRB]);
  const WRB2 = material({ id: "pmat_wrb2", name: "Air barrier", category: "membrane" });
  const byIdTwo = materialById([material(), WRB, WRB2]);

  test("leaves an ordinary layer's box on its drawn band", () => {
    const geometry = buildAssemblyCanvasGeometry(
      assembly([layer("lyr_insul", 140, ["pmat_insul"])]),
      byId,
    );
    const insul = geometry.layers[0];
    if (!insul) throw new Error("expected a layer");

    expect(canvasHitBox(insul, 1)).toEqual({ topPx: 0, heightPx: 140 });
  });

  test("grows a membrane's box to the clickable minimum, centred on the band", () => {
    const geometry = buildAssemblyCanvasGeometry(
      assembly([layer("lyr_insul", 140, ["pmat_insul"]), layer("lyr_wrb", 0.15, ["pmat_wrb"])]),
      byId,
    );
    const membrane = geometry.layers[1];
    if (!membrane) throw new Error("expected a membrane layer");

    const box = canvasHitBox(membrane, 1);
    expect(box.heightPx).toBe(MEMBRANE_MIN_HIT_HEIGHT_PX);
    // Centred: the overhang above equals the overhang below.
    const overhang = (MEMBRANE_MIN_HIT_HEIGHT_PX - MEMBRANE_DISPLAY_THICKNESS_MM) / 2;
    expect(box.topPx).toBe(membrane.yMm - overhang);
  });

  test("two adjacent membranes meet at the shared edge instead of overlapping", () => {
    // Realistic: a dedicated air barrier stacked straight onto a WRB. Without
    // the cap both boxes expand into each other's band, tie on z-index, and
    // paint order alone decides which one a click selects.
    const geometry = buildAssemblyCanvasGeometry(
      assembly([
        layer("lyr_wrb", 0.15, ["pmat_wrb"]),
        layer("lyr_ab", 0.8, ["pmat_wrb2"]),
        layer("lyr_insul", 140, ["pmat_insul"]),
      ]),
      byIdTwo,
    );
    const [first, second] = geometry.layers;
    if (!first || !second) throw new Error("expected two membrane layers");

    for (const zoom of [0.5, 1, 3]) {
      const upper = canvasHitBox(first, zoom);
      const lower = canvasHitBox(second, zoom);
      expect(upper.topPx + upper.heightPx).toBeLessThanOrEqual(lower.topPx);
    }
  });
});
