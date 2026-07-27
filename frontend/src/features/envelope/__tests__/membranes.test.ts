import { describe, expect, test } from "vitest";
import { buildAssemblyCanvasGeometry } from "../canvas-geometry";
import { materialById } from "../lib";
import { MEMBRANE_BAND_HEIGHT_MM } from "../canvas-constants";
import { isMembraneLayer, isMembraneMaterial } from "../membranes";
import { membraneStrokeColor } from "../components/AssemblySvgCanvas";
import type { Assembly, AssemblyFace, AssemblyLayer, ProjectMaterial } from "../types";

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
    exterior_condition: "outdoor_air",
    air_barrier: null,
    air_barrier_status: null,
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

  test("draws a membrane in its reserved band, not at its real thickness", () => {
    const geometry = buildAssemblyCanvasGeometry(
      assembly([layer("lyr_wrb", 0.15, ["pmat_wrb"])]),
      byId,
    );

    const [membrane] = geometry.layers;
    expect(membrane?.isMembrane).toBe(true);
    expect(membrane?.heightMm).toBe(MEMBRANE_BAND_HEIGHT_MM);
    // The real value is untouched on the model — it is what the dimension
    // column and Total Thickness report.
    expect(membrane?.layer.thickness_mm).toBe(0.15);
  });

  test("stacks following layers below the reserved band, so nothing overlaps", () => {
    const geometry = buildAssemblyCanvasGeometry(
      assembly([layer("lyr_wrb", 0.15, ["pmat_wrb"]), layer("lyr_insul", 140, ["pmat_insul"])]),
      byId,
    );

    expect(geometry.layers[1]?.yMm).toBe(MEMBRANE_BAND_HEIGHT_MM);
    expect(geometry.heightMm).toBe(MEMBRANE_BAND_HEIGHT_MM + 140);
    expect(geometry.segments[1]?.yMm).toBe(MEMBRANE_BAND_HEIGHT_MM);
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

describe("air-barrier line placement", () => {
  const byId = materialById([material()]);
  // Two 100 mm layers: layer 0 spans y 0–100, layer 1 spans y 100–200.
  const layers = [layer("lyr_outer", 100, ["pmat_insul"]), layer("lyr_inner", 100, ["pmat_insul"])];

  function lineY(orientation: Assembly["orientation"], face: AssemblyFace): number | undefined {
    const base = assembly(layers);
    const geometry = buildAssemblyCanvasGeometry(
      { ...base, orientation, air_barrier: { layer_id: "lyr_outer", face } },
      byId,
    );
    return geometry.airBarrier?.yMm;
  }

  test("no designation draws no line", () => {
    expect(buildAssemblyCanvasGeometry(assembly(layers), byId).airBarrier).toBeNull();
  });

  // "Interior" and "exterior" are orientation-relative, not top/bottom. Drawing
  // the rule on the wrong side of the layer is a silently wrong drawing, which
  // is worse than none — so pin both orientations.
  test("first_layer_outside puts the exterior face at the layer's top edge", () => {
    expect(lineY("first_layer_outside", "exterior")).toBe(0);
    expect(lineY("first_layer_outside", "interior")).toBe(100);
  });

  test("last_layer_outside flips it: the exterior face is the bottom edge", () => {
    expect(lineY("last_layer_outside", "exterior")).toBe(100);
    expect(lineY("last_layer_outside", "interior")).toBe(0);
  });

  test("a designation pointing at no layer of this assembly draws nothing", () => {
    const base = assembly(layers);
    const geometry = buildAssemblyCanvasGeometry(
      { ...base, air_barrier: { layer_id: "lyr_gone", face: "interior" } },
      byId,
    );
    expect(geometry.airBarrier).toBeNull();
  });
});

describe("membraneStrokeColor", () => {
  // A membrane draws as a rule, so its colour IS the whole mark. `materialColor`
  // answers a missing colour with `transparent`, which for a rule means the
  // layer silently disappears while still holding its band and its click box.
  // Found in the wild on a real assembly whose membrane had no colour set.
  test("defers to CSS when the material has no colour", () => {
    expect(membraneStrokeColor(material({ category: "membrane", color: null }))).toBeUndefined();
    expect(membraneStrokeColor(null)).toBeUndefined();
  });

  test("uses the material colour when there is one", () => {
    expect(membraneStrokeColor(material({ category: "membrane", color: "#3a7bd5" }))).toBe(
      "#3a7bd5",
    );
  });
});

describe("band stacking", () => {
  const WRB2 = material({ id: "pmat_wrb2", name: "Air barrier", category: "membrane" });
  const GYPSUM = material({ id: "pmat_gyp", name: "Gypsum", category: "finishes" });
  const byId = materialById([material(), WRB, WRB2, GYPSUM]);

  // The drawn band is also the clickable box, so "bands never overlap" is the
  // whole click-routing contract. The previous design grew a membrane's box
  // past its band to make it clickable, which let it steal clicks from a thin
  // neighbour (10 mm gypsum) and from an adjacent membrane. Reserving real
  // space makes the property structural — keep it that way.
  test("every layer's band is contiguous with the next and never overlaps it", () => {
    const geometry = buildAssemblyCanvasGeometry(
      assembly([
        layer("lyr_gyp", 10, ["pmat_gyp"]),
        layer("lyr_wrb", 0.15, ["pmat_wrb"]),
        layer("lyr_ab", 0.8, ["pmat_wrb2"]),
        layer("lyr_insul", 140, ["pmat_insul"]),
      ]),
      byId,
    );

    expect(geometry.layers).toHaveLength(4);
    geometry.layers.forEach((entry, index) => {
      const next = geometry.layers[index + 1];
      if (next) expect(entry.yMm + entry.heightMm).toBe(next.yMm);
    });
  });

  test("two adjacent membranes each get a full band", () => {
    // Realistic: a dedicated air barrier stacked straight onto a WRB. Neither
    // has to borrow space from the other, so neither can win the other's click.
    const geometry = buildAssemblyCanvasGeometry(
      assembly([layer("lyr_wrb", 0.15, ["pmat_wrb"]), layer("lyr_ab", 0.8, ["pmat_wrb2"])]),
      byId,
    );

    for (const entry of geometry.layers) {
      expect(entry.isMembrane).toBe(true);
      expect(entry.heightMm).toBe(MEMBRANE_BAND_HEIGHT_MM);
    }
  });
});
