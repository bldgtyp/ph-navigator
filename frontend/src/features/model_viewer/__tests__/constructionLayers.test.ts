import { describe, expect, it } from "vitest";
import { buildConstructionLayers, phColorToCss } from "../lib/constructionLayers";
import type { ConstructionMaterial, DetailedOpaqueConstruction } from "../types";

/** Indexed access that satisfies noUncheckedIndexedAccess in assertions. */
function at<T>(items: T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`expected item at index ${index}`);
  return item;
}

function material(overrides: Partial<ConstructionMaterial> = {}): ConstructionMaterial {
  return {
    type: "EnergyMaterial",
    identifier: "Cellulose",
    display_name: null,
    thickness: 0.14,
    conductivity: 0.04,
    properties: {
      ph: {
        ph_color: { a: 255, r: 200, g: 180, b: 140 },
        divisions: { column_widths: [], row_heights: [], steel_stud_spacing_mm: null, cells: [] },
      },
    },
    ...overrides,
  };
}

function construction(materials: ConstructionMaterial[]): DetailedOpaqueConstruction {
  return {
    identifier: "Test Construction",
    type: "OpaqueConstruction",
    u_factor: 0.25,
    u_value: 0.28,
    r_factor: 4.0,
    r_value: 3.5,
    materials,
  };
}

describe("buildConstructionLayers — flat layers (D-5 degenerate case)", () => {
  it("yields one full-extent cell per homogeneous layer, in exterior→interior order", () => {
    const layers = buildConstructionLayers(
      construction([material({ identifier: "XPS" }), material({ identifier: "Gypsum" })]),
    );
    expect(layers.map((layer) => layer.label)).toEqual(["XPS", "Gypsum"]);
    for (const layer of layers) {
      expect(layer.cells).toHaveLength(1);
      expect(at(layer.cells, 0)).toMatchObject({
        xFraction: 0,
        widthFraction: 1,
        yFraction: 0,
        heightFraction: 1,
      });
    }
  });

  it("prefers display_name over identifier for labels", () => {
    const layer = at(
      buildConstructionLayers(
        construction([material({ identifier: "mat_001", display_name: "Dense-Pack Cellulose" })]),
      ),
      0,
    );
    expect(layer.label).toBe("Dense-Pack Cellulose");
    expect(at(layer.cells, 0).label).toBe("Dense-Pack Cellulose");
  });

  it("computes per-layer R = thickness / conductivity, guarding λ = 0", () => {
    const layers = buildConstructionLayers(
      construction([
        material({ thickness: 0.14, conductivity: 0.04 }),
        material({ thickness: 0.1, conductivity: 0 }),
      ]),
    );
    expect(at(layers, 0).rValue).toBeCloseTo(3.5, 10);
    expect(at(layers, 1).rValue).toBe(0);
  });

  it("treats a material without ph properties as flat", () => {
    const layer = at(buildConstructionLayers(construction([material({ properties: null })])), 0);
    expect(layer.cells).toHaveLength(1);
    expect(at(layer.cells, 0).color).toBeNull();
  });
});

describe("buildConstructionLayers — framed layers", () => {
  const framed = material({
    identifier: "Cellulose+Stud Cavity",
    conductivity: 0.05,
    properties: {
      ph: {
        ph_color: null,
        divisions: {
          column_widths: [0.4, 0.038, 0.4],
          row_heights: [1.0],
          steel_stud_spacing_mm: null,
          cells: [
            { row: 0, column: 0, material: material({ identifier: "Cellulose" }) },
            {
              row: 0,
              column: 1,
              material: material({ identifier: "Wood Stud", conductivity: 0.12 }),
            },
            { row: 0, column: 2, material: material({ identifier: "Cellulose" }) },
          ],
        },
      },
    },
  });

  it("yields one cell per division cell with width fractions summing to 1", () => {
    const layer = at(buildConstructionLayers(construction([framed])), 0);
    expect(layer.cells).toHaveLength(3);
    const total = layer.cells.reduce((sum, cell) => sum + cell.widthFraction, 0);
    expect(total).toBeCloseTo(1, 10);
    expect(at(layer.cells, 1).widthFraction).toBeCloseTo(0.038 / 0.838, 10);
    expect(at(layer.cells, 1).xFraction).toBeCloseTo(0.4 / 0.838, 10);
  });

  it("colors cells from the CELL material, not the homogenized layer (D-6)", () => {
    const layer = at(buildConstructionLayers(construction([framed])), 0);
    for (const cell of layer.cells) {
      expect(cell.color).toBe("rgba(200, 180, 140, 1)");
    }
    expect(at(layer.cells, 1).conductivity).toBeCloseTo(0.12, 10);
  });

  it("surfaces steel-stud spacing on the layer", () => {
    const steel = material({
      identifier: "Steel Stud Cavity",
      properties: {
        ph: {
          ph_color: null,
          divisions: {
            column_widths: [1.0],
            row_heights: [1.0],
            steel_stud_spacing_mm: 406.4,
            cells: [{ row: 0, column: 0, material: material() }],
          },
        },
      },
    });
    const layers = buildConstructionLayers(construction([steel, material()]));
    expect(at(layers, 0).steelStudSpacingMm).toBeCloseTo(406.4, 10);
    expect(at(layers, 1).steelStudSpacingMm).toBeNull();
  });

  it("falls back to equal fractions on degenerate column widths (no NaN)", () => {
    const degenerate = material({
      properties: {
        ph: {
          ph_color: null,
          divisions: {
            column_widths: [],
            row_heights: [],
            steel_stud_spacing_mm: null,
            cells: [
              { row: 0, column: 0, material: material() },
              { row: 0, column: 1, material: material() },
            ],
          },
        },
      },
    });
    const layer = at(buildConstructionLayers(construction([degenerate])), 0);
    expect(layer.cells).toHaveLength(2);
    for (const cell of layer.cells) {
      expect(cell.widthFraction).toBeCloseTo(0.5, 10);
      expect(Number.isNaN(cell.xFraction)).toBe(false);
    }
  });

  it("places multi-row grids with y/height fractions (Q4 general case)", () => {
    const grid = material({
      properties: {
        ph: {
          ph_color: null,
          divisions: {
            column_widths: [0.5, 0.5],
            row_heights: [0.25, 0.75],
            steel_stud_spacing_mm: null,
            cells: [
              { row: 1, column: 0, material: material({ identifier: "C" }) },
              { row: 0, column: 0, material: material({ identifier: "A" }) },
              { row: 0, column: 1, material: material({ identifier: "B" }) },
              { row: 1, column: 1, material: material({ identifier: "D" }) },
            ],
          },
        },
      },
    });
    const layer = at(buildConstructionLayers(construction([grid])), 0);
    // Sorted row-major regardless of wire order.
    expect(layer.cells.map((cell) => cell.label)).toEqual(["A", "B", "C", "D"]);
    expect(at(layer.cells, 0)).toMatchObject({ yFraction: 0, heightFraction: 0.25 });
    expect(at(layer.cells, 2)).toMatchObject({ yFraction: 0.25, heightFraction: 0.75 });
  });
});

describe("helpers", () => {
  it("phColorToCss converts ARGB to css rgba and passes null through", () => {
    expect(phColorToCss({ a: 128, r: 10, g: 20, b: 30 })).toBe(
      "rgba(10, 20, 30, 0.5019607843137255)",
    );
    expect(phColorToCss(null)).toBeNull();
    expect(phColorToCss(undefined)).toBeNull();
  });
});
