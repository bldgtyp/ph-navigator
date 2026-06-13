import { describe, expect, test } from "vitest";
import { resolveViewerTokens } from "../lib/colors";
import { fieldValue, inspectorConfigs } from "../lib/fieldConfigs";
import { isClickWithinDragTolerance } from "../lib/selection";
import { buildBuildingModel } from "../loaders/building";
import type { CombinedModelData, ModelObjectMeta } from "../types";

describe("buildBuildingModel", () => {
  test("builds face and aperture geometry with stable object metadata", () => {
    const model = buildBuildingModel(sampleModelData());

    expect(model.objectCounts).toEqual({ faceMesh: 1, apertureMeshFace: 1 });
    expect(model.objects).toHaveLength(2);
    expect(model.metaById.get("face:wall-1")).toMatchObject({
      type: "faceMesh",
      display_name: "North Wall",
      area: 12,
    });
    expect(model.objects[0]?.geometry.getAttribute("position").count).toBe(6);
    expect(model.bounds.isEmpty()).toBe(false);
  });
});

describe("viewer core helpers", () => {
  test("keeps the V1 5 px drag-vs-click tolerance", () => {
    expect(
      isClickWithinDragTolerance({ clientX: 10, clientY: 10 }, { clientX: 15, clientY: 15 }),
    ).toBe(true);
    expect(
      isClickWithinDragTolerance({ clientX: 10, clientY: 10 }, { clientX: 16, clientY: 15 }),
    ).toBe(false);
  });

  test("resolves the D-14 highlight fallback when CSS tokens are unavailable", () => {
    const root = document.createElement("div");
    expect(resolveViewerTokens(root).highlight).toBe("#E23489");
  });

  test("formats D-12 construction rows and missing values for the inspector", () => {
    const meta = sampleMeta();
    const config = inspectorConfigs.faceMesh;
    expect(config).toBeDefined();
    if (!config) throw new Error("faceMesh config missing");
    const uFactor = config.sections[1]?.fields.find((field) => field.label === "U-Factor");
    const rValue = config.sections[1]?.fields.find((field) => field.label === "R-Value");
    expect(uFactor).toBeDefined();
    expect(rValue).toBeDefined();
    expect(fieldValue(meta, uFactor!, "IP")).toBe("0.053 Btu/(h-ft2-F)");
    expect(fieldValue(meta, rValue!, "SI")).toBe("--");
  });
});

function sampleModelData(): CombinedModelData {
  return {
    faces: [
      {
        type: "Face",
        identifier: "wall-1",
        display_name: "North Wall",
        face_type: "Wall",
        geometry: {
          boundary: [
            [0, 0, 0],
            [2, 0, 0],
            [2, 0, 3],
            [0, 0, 3],
          ],
          plane: { n: [0, -1, 0], o: [0, 0, 0], x: [1, 0, 0] },
          mesh: {
            vertices: [
              [0, 0, 0],
              [2, 0, 0],
              [2, 0, 3],
              [0, 0, 3],
            ],
            faces: [
              [0, 1, 2],
              [0, 2, 3],
            ],
          },
          area: 12,
        },
        boundary_condition: { type: "Outdoors" },
        properties: { energy: { construction: construction() } },
        apertures: [
          {
            identifier: "win-1",
            display_name: "Window 1",
            face_type: "Aperture",
            geometry: {
              boundary: [
                [0.5, 0, 1],
                [1.5, 0, 1],
                [1.5, 0, 2],
                [0.5, 0, 2],
              ],
              plane: { n: [0, -1, 0], o: [0, 0, 0], x: [1, 0, 0] },
              mesh: {
                vertices: [
                  [0.5, 0, 1],
                  [1.5, 0, 1],
                  [1.5, 0, 2],
                  [0.5, 0, 2],
                ],
                faces: [
                  [0, 1, 2],
                  [0, 2, 3],
                ],
              },
              area: 1,
            },
            boundary_condition: { type: "Outdoors" },
            properties: { energy: { construction: construction() } },
          },
        ],
      },
    ],
    spaces: [],
    sun_path: null,
    hot_water_systems: [],
    ventilation_systems: [],
    shading_elements: [],
    load_summary: {
      air_boundaries_skipped: 0,
      faces_extracted: 1,
      spaces_extracted: 0,
      shade_groups_extracted: 0,
      extraction_warnings: [],
    },
  };
}

const construction = () => ({
  identifier: "WALL-C3",
  type: "OpaqueConstruction",
  u_factor: 0.3,
  u_value: 0.31,
  r_factor: 3.33,
  r_value: null,
});

function sampleMeta(): ModelObjectMeta {
  return {
    id: "face:wall-1",
    type: "faceMesh",
    identifier: "wall-1",
    display_name: "North Wall",
    face_type: "Wall",
    boundary_condition: { type: "Outdoors" },
    area: 12,
    properties: { energy: { construction: construction() } },
    vertices: [],
  };
}
