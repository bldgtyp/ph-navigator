import { describe, expect, test } from "vitest";
import { elementIdForSegmentId, resolveLineHighlightTier } from "../lib/selection";
import { buildBuildingModel } from "../loaders/building";
import type { CombinedModelData } from "../types";

describe("model viewer MEP elements", () => {
  test("builds duct and pipe element summaries from segment renderables", () => {
    const model = buildBuildingModel(mepElementData());

    expect(model.elementsById.get("element:duct:supply-duct")).toMatchObject({
      kind: "ductElement",
      identifier: "supply-duct",
      length: 7,
      segmentIds: ["duct:supply-duct:seg-a", "duct:supply-duct:seg-b"],
    });
    expect(model.elementsById.get("element:pipe:distribution:fixture-1")).toMatchObject({
      kind: "pipeElement",
      identifier: "fixture-1",
      length: 3,
      segmentIds: ["pipe:distribution:fixture-1:seg-p"],
    });
    expect(model.elementsById.get("element:pipe:recirc:recirc-1")).toMatchObject({
      kind: "pipeElement",
      pipeKind: "recirc",
      segmentIds: ["pipe:recirc:recirc-1:seg-r"],
    });
  });

  test("derives element ids from duct and pipe segment ids", () => {
    expect(elementIdForSegmentId("duct:duct-1:seg-1")).toBe("element:duct:duct-1");
    expect(elementIdForSegmentId("pipe:distribution:pipe-1:seg-1")).toBe(
      "element:pipe:distribution:pipe-1",
    );
    expect(elementIdForSegmentId("duct:identifier:with:colon:seg-1")).toBe(
      "element:duct:identifier:with:colon",
    );
    expect(elementIdForSegmentId("face:wall-1")).toBeNull();
  });

  test.each([
    {
      name: "default",
      objectId: "duct:supply-duct:seg-a",
      selectionId: null,
      hoverId: null,
      focusedSegmentId: null,
      tier: "default",
    },
    {
      name: "hoverElement",
      objectId: "duct:supply-duct:seg-a",
      selectionId: null,
      hoverId: "duct:supply-duct:seg-b",
      focusedSegmentId: null,
      tier: "hoverElement",
    },
    {
      name: "selectedSoft",
      objectId: "duct:supply-duct:seg-a",
      selectionId: "element:duct:supply-duct",
      hoverId: null,
      focusedSegmentId: null,
      tier: "selectedSoft",
    },
    {
      name: "hoverSegment",
      objectId: "duct:supply-duct:seg-a",
      selectionId: "element:duct:supply-duct",
      hoverId: "duct:supply-duct:seg-a",
      focusedSegmentId: null,
      tier: "hoverSegment",
    },
    {
      name: "focused",
      objectId: "duct:supply-duct:seg-a",
      selectionId: "element:duct:supply-duct",
      hoverId: "duct:supply-duct:seg-a",
      focusedSegmentId: "duct:supply-duct:seg-a",
      tier: "focused",
    },
    {
      name: "different hovered element while another element is selected",
      objectId: "duct:other-duct:seg-a",
      selectionId: "element:duct:supply-duct",
      hoverId: "duct:other-duct:seg-b",
      focusedSegmentId: null,
      tier: "hoverElement",
    },
  ] as const)(
    "resolves line highlight tier: $name",
    ({ objectId, selectionId, hoverId, focusedSegmentId, tier }) => {
      expect(resolveLineHighlightTier(objectId, selectionId, hoverId, focusedSegmentId)).toBe(tier);
    },
  );
});

function mepElementData(): CombinedModelData {
  return {
    faces: [],
    spaces: [],
    shading_elements: [],
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
            length: 7,
            segments: {
              "seg-a": ductSegment({ p: [0, 0, 0], v: [3, 0, 0] }),
              "seg-b": ductSegment({ p: [3, 0, 0], v: [4, 0, 0] }),
            },
          },
        ],
        exhaust_ducting: [],
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
                    "seg-p": pipeSegment({ p: [0, 0, 0], v: [0, 0, 3] }),
                  }),
                },
              },
            },
          },
        },
        recirc_piping: {
          "recirc-1": pipeElement("recirc-1", "Recirc", {
            "seg-r": pipeSegment({ p: [1, 0, 0], v: [0, 0, 2] }),
          }),
        },
      },
    ],
    load_summary: {
      air_boundaries_skipped: 0,
      faces_extracted: 0,
      spaces_extracted: 0,
      shade_groups_extracted: 0,
      extraction_warnings: [],
    },
  };
}

function ductSegment(geometry: { p: [number, number, number]; v: [number, number, number] }) {
  const [x, y, z] = geometry.v;
  return {
    identifier: "segment",
    display_name: "Duct Segment",
    geometry,
    diameter: 0.16,
    height: null,
    width: null,
    insulation_thickness: 0.025,
    insulation_conductivity: 0.04,
    insulation_reflective: false,
    length: Math.hypot(x, y, z),
  };
}

function pipeSegment(geometry: { p: [number, number, number]; v: [number, number, number] }) {
  const [x, y, z] = geometry.v;
  return {
    geometry,
    diameter_mm: 12.7,
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
