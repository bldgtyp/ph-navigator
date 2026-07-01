import { describe, expect, test } from "vitest";
import { resolveViewerTokens } from "../lib/colors";
import { fieldValue, inspectorConfigs } from "../lib/fieldConfigs";
import { disabledLensReason, parseModelViewerLens } from "../lib/lenses";
import { isClickWithinDragTolerance } from "../lib/selection";
import { buildBuildingModel } from "../loaders/building";
import type { CombinedModelData, ModelObjectMeta } from "../types";

describe("buildBuildingModel", () => {
  test("builds face and aperture geometry with stable object metadata", () => {
    const model = buildBuildingModel(sampleModelData());

    expect(model.objectCounts).toEqual({
      faceMesh: 1,
      apertureMeshFace: 1,
      spaceGroup: 0,
      spaceFloorSegmentMeshFace: 0,
      ductSegmentLine: 0,
      pipeSegmentLine: 0,
    });
    expect(model.objects).toHaveLength(2);
    expect(model.metaById.get("face:wall-1")).toMatchObject({
      type: "faceMesh",
      display_name: "North Wall",
      area: 12,
    });
    const firstObject = model.objects[0];
    expect(firstObject?.kind).toBe("mesh");
    if (firstObject?.kind !== "mesh") throw new Error("fixture first object must be a mesh");
    expect(firstObject.geometries[0]?.getAttribute("position").count).toBe(6);
    expect(model.bounds.isEmpty()).toBe(false);
  });

  test("builds Phase 04 lens geometry and availability from the combined DTO", () => {
    const model = buildBuildingModel(samplePhaseFourData());

    expect(model.objectCounts).toEqual({
      faceMesh: 1,
      apertureMeshFace: 0,
      spaceGroup: 1,
      spaceFloorSegmentMeshFace: 1,
      ductSegmentLine: 2,
      pipeSegmentLine: 2,
    });
    expect(model.lensAvailability).toEqual({
      building: true,
      spaces: true,
      "floor-areas": true,
      "site-sun": true,
      ventilation: true,
      "hot-water": true,
    });
    expect(model.metaById.get("duct:supply-duct:seg-1")).toMatchObject({
      type: "ductSegmentLine",
      duct_type: 1,
      diameter_m: 0.16,
    });
    expect(model.metaById.get("pipe:recirc:recirc-1:seg-r")).toMatchObject({
      type: "pipeSegmentLine",
      pipe_kind: "recirc",
      diameter_mm: 19,
    });
  });

  test("builds Site & Sun shade meshes without adding selectable objects", () => {
    const model = buildBuildingModel(sampleSiteSunData());

    // Shades merge per display_name (D-7); each group is one renderable.
    expect(model.shadeObjects).toHaveLength(2);
    expect(model.shadeObjects[0]).toMatchObject({
      id: "shade:South Overhangs",
      displayName: "South Overhangs",
    });
    expect(model.shadeObjects[1]).toMatchObject({
      id: "shade:South Side Fin",
      displayName: "South Side Fin",
    });
    expect(model.objectCounts).toEqual({
      faceMesh: 1,
      apertureMeshFace: 1,
      spaceGroup: 0,
      spaceFloorSegmentMeshFace: 0,
      ductSegmentLine: 0,
      pipeSegmentLine: 0,
    });
    expect(model.lensAvailability["site-sun"]).toBe(true);
    expect(model.metaById.has("shade:shade-1a")).toBe(false);
    expect(model.metaById.has("shade:shade-1b")).toBe(false);
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

  test("formats Phase 04 inspector fields with unit conversion", () => {
    const model = buildBuildingModel(samplePhaseFourData());
    const spaceMeta = model.metaById.get("space:space-1");
    const ductMeta = model.metaById.get("duct:supply-duct:seg-1");
    const pipeMeta = model.metaById.get("pipe:distribution:fixture-1:seg-p");
    expect(spaceMeta).toBeDefined();
    expect(ductMeta).toBeDefined();
    expect(pipeMeta).toBeDefined();

    const supplyAir = inspectorConfigs.spaceGroup.sections[1]?.fields[0];
    const ductType = inspectorConfigs.ductSegmentLine.sections[0]?.fields.find(
      (field) => field.id === "duct_type",
    );
    const pipeTemp = inspectorConfigs.pipeSegmentLine.sections[0]?.fields.find(
      (field) => field.id === "water_temp_c",
    );
    expect(fieldValue(spaceMeta!, supplyAir!, "SI")).toBe("36 m3/h");
    expect(fieldValue(spaceMeta!, supplyAir!, "IP")).toBe("21.2 cfm");
    expect(fieldValue(ductMeta!, ductType!, "SI")).toBe("Supply");
    expect(fieldValue(pipeMeta!, pipeTemp!, "IP")).toBe("140 deg F");
  });

  test("parses lens URL tokens and derives disabled reasons", () => {
    const model = buildBuildingModel(sampleModelData());
    expect(parseModelViewerLens("ventilation")).toBe("ventilation");
    expect(parseModelViewerLens("bad-token")).toBe("building");
    expect(disabledLensReason("site-sun", model.lensAvailability)).toBeNull();
    expect(disabledLensReason("hot-water", model.lensAvailability)).toBe(
      "No hot-water piping in this model",
    );
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

function samplePhaseFourData(): CombinedModelData {
  const base = sampleModelData();
  return {
    ...base,
    faces: base.faces.map((face) => ({ ...face, apertures: [] })),
    spaces: [
      {
        identifier: "space-1",
        quantity: 1,
        name: "Kitchen",
        number: "101",
        wufi_type: 99,
        volumes: [
          {
            identifier: "volume-1",
            display_name: "Kitchen Volume",
            avg_ceiling_height: 3,
            geometry: [rectFace(0, 0, 0, 3, 0, 3)],
            floor: {
              identifier: "floor-1",
              display_name: "Kitchen Floor",
              geometry: rectFace(0, 0, 0, 3, 3, 0),
              floor_segments: [
                {
                  identifier: "floor-seg-1",
                  display_name: "Kitchen Floor Segment",
                  geometry: rectFace(0, 0, 0, 3, 3, 0),
                  weighting_factor: 1,
                  floor_area: 9,
                  weighted_floor_area: 9,
                },
              ],
            },
          },
        ],
        properties: {
          ph: { id_num: 1, type: "SpacePhProperties", _v_sup: 0.01, _v_eta: null, _v_tran: 0 },
        },
        net_volume: 27,
        floor_area: 9,
        weighted_floor_area: 9,
        avg_clear_height: 3,
        average_floor_weighting_factor: 1,
      },
    ],
    ventilation_systems: [
      {
        identifier: "vent-1",
        display_name: "ERV 1",
        sys_type: 1,
        supply_ducting: [
          {
            identifier: "supply-duct",
            display_name: "Supply Duct",
            duct_type: 1,
            segments: {
              "seg-1": {
                identifier: "seg-1",
                display_name: "Supply Segment",
                geometry: { p: [0, 0, 2], v: [3, 0, 0] },
                diameter: 0.16,
                height: null,
                width: null,
                insulation_thickness: 0.025,
                insulation_conductivity: 0.04,
                insulation_reflective: false,
                length: 3,
              },
            },
            length: 3,
          },
        ],
        exhaust_ducting: [
          {
            identifier: "exhaust-duct",
            display_name: "Exhaust Duct",
            duct_type: 2,
            segments: {
              "seg-2": {
                identifier: "seg-2",
                display_name: "Exhaust Segment",
                geometry: { p: [0, 1, 2], v: [3, 0, 0] },
                diameter: 0.14,
                height: null,
                width: null,
                insulation_thickness: 0.02,
                insulation_conductivity: 0.04,
                insulation_reflective: false,
                length: 3,
              },
            },
            length: 3,
          },
        ],
      },
    ],
    hot_water_systems: [
      {
        identifier: "dhw-1",
        display_name: "DHW",
        distribution_piping: {
          "trunk-1": {
            identifier: "trunk-1",
            display_name: "Trunk",
            multiplier: 1,
            pipe_element: pipeElement("empty-trunk", "Empty Trunk", {}),
            branches: {
              "branch-1": {
                identifier: "branch-1",
                display_name: "Branch",
                pipe_element: pipeElement("empty-branch", "Empty Branch", {}),
                fixtures: {
                  "fixture-1": pipeElement("fixture-1", "Sink", {
                    "seg-p": pipeSegment({
                      diameter_mm: 12.7,
                      geometry: { p: [0, 0, 0], v: [0, 0, 3] },
                    }),
                  }),
                },
              },
            },
          },
        },
        recirc_piping: {
          "recirc-1": pipeElement("recirc-1", "Recirc", {
            "seg-r": pipeSegment({ diameter_mm: 19, geometry: { p: [1, 0, 0], v: [0, 0, 3] } }),
          }),
        },
      },
    ],
    load_summary: {
      ...base.load_summary,
      spaces_extracted: 1,
    },
  };
}

function sampleSiteSunData(): CombinedModelData {
  return {
    ...sampleModelData(),
    shading_elements: [
      {
        shades: [
          {
            type: "Shade",
            identifier: "shade-1a",
            user_data: null,
            display_name: "South Overhangs",
            is_detached: true,
            geometry: rectFace(0, -1, 3, 2, 1, 0),
          },
          {
            type: "Shade",
            identifier: "shade-1b",
            user_data: null,
            display_name: "South Side Fin",
            is_detached: true,
            geometry: rectFace(2, -1, 0, 1, 0, 3),
          },
        ],
      },
    ],
    load_summary: {
      air_boundaries_skipped: 0,
      faces_extracted: 1,
      spaces_extracted: 0,
      shade_groups_extracted: 1,
      extraction_warnings: [],
    },
  };
}

function pipeSegment({
  diameter_mm,
  geometry,
}: {
  diameter_mm: number;
  geometry: { p: [number, number, number]; v: [number, number, number] };
}) {
  const [x, y, z] = geometry.v;
  return {
    geometry,
    diameter_mm,
    insulation_thickness_mm: 13,
    insulation_conductivity: 0.04,
    insulation_reflective: false,
    insulation_quality: null,
    daily_period: 24,
    water_temp_c: 60,
    material_value: "Copper",
    length: Math.hypot(x, y, z),
  };
}

type SamplePipeSegment = ReturnType<typeof pipeSegment>;

function pipeElement(
  identifier: string,
  display_name: string,
  segments: Record<string, SamplePipeSegment>,
) {
  const segmentList = Object.values(segments);
  return {
    identifier,
    display_name,
    segments,
    length: segmentList.reduce((total, segment) => total + segment.length, 0),
    water_temp: 60,
    daily_period: 24,
    material_name: "Copper",
    diameter: segmentList[0]?.diameter_mm ?? 0,
  };
}

function rectFace(x: number, y: number, z: number, width: number, depth: number, height: number) {
  const vertices: [number, number, number][] =
    height === 0
      ? [
          [x, y, z],
          [x + width, y, z],
          [x + width, y + depth, z],
          [x, y + depth, z],
        ]
      : [
          [x, y, z],
          [x + width, y, z],
          [x + width, y, z + height],
          [x, y, z + height],
        ];
  return {
    boundary: vertices,
    plane: {
      n: [0, 0, 1] as [number, number, number],
      o: vertices[0]!,
      x: [1, 0, 0] as [number, number, number],
    },
    mesh: {
      vertices,
      faces: [
        [0, 1, 2],
        [0, 2, 3],
      ],
    },
    area: width * (height || depth),
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
