import { describe, expect, test } from "vitest";
import { buildBuildingModel } from "../loaders/building";
import { fieldValue, inspectorConfigs } from "../lib/fieldConfigs";
import type { CombinedModelData, Face3D } from "../types";

describe("aperture shading factor metadata", () => {
  test("carries both seasonal factors into aperture render metadata", () => {
    const model = buildBuildingModel(modelData());
    const aperture = model.metaById.get("aperture:window");
    expect(aperture?.type).toBe("apertureMeshFace");
    if (aperture?.type !== "apertureMeshFace") throw new Error("fixture aperture is missing");

    expect(aperture.properties.ph).toEqual({
      summer_shading_factor: 0.2,
      winter_shading_factor: 0.8,
    });
  });

  test("formats both inspector factors to three decimals and marks legacy values missing", () => {
    const aperture = buildBuildingModel(modelData()).metaById.get("aperture:window");
    if (aperture?.type !== "apertureMeshFace") throw new Error("fixture aperture is missing");
    const section = inspectorConfigs.apertureMeshFace.sections.find(
      (candidate) => candidate.title === "Shading Factors",
    );
    const summer = section?.fields.find((field) => field.id === "summer_shading_factor");
    const winter = section?.fields.find((field) => field.id === "winter_shading_factor");
    if (!summer || !winter) throw new Error("shading factor inspector fields are missing");

    expect(fieldValue(aperture, summer, "SI")).toBe("0.200");
    expect(fieldValue(aperture, winter, "SI")).toBe("0.800");

    const legacyData = structuredClone(modelData());
    delete legacyData.faces[0]?.apertures[0]?.properties.ph;
    const legacyAperture = buildBuildingModel(legacyData).metaById.get("aperture:window");
    if (legacyAperture?.type !== "apertureMeshFace") {
      throw new Error("legacy fixture aperture is missing");
    }
    expect(fieldValue(legacyAperture, summer, "SI")).toBe("Missing");
    expect(fieldValue(legacyAperture, winter, "SI")).toBe("Missing");
  });
});

function modelData(): CombinedModelData {
  const geometry = squareGeometry();
  return {
    faces: [
      {
        type: "Face",
        identifier: "wall",
        display_name: "Wall",
        face_type: "Wall",
        geometry,
        boundary_condition: { type: "Outdoors" },
        properties: { energy: { construction: null } },
        apertures: [
          {
            identifier: "window",
            display_name: "Window",
            face_type: "Aperture",
            geometry,
            boundary_condition: { type: "Outdoors" },
            properties: {
              energy: { construction: null },
              ph: { summer_shading_factor: 0.2, winter_shading_factor: 0.8 },
            },
          },
        ],
      },
    ],
    constructions: {},
    spaces: [],
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

function squareGeometry(): Face3D {
  const vertices: [number, number, number][] = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
  ];
  return {
    boundary: vertices,
    plane: { n: [0, 0, 1], o: [0, 0, 0], x: [1, 0, 0] },
    mesh: {
      vertices,
      faces: [
        [0, 1, 2],
        [0, 2, 3],
      ],
    },
    area: 1,
  };
}
