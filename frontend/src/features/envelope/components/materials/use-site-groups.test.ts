import { describe, expect, test } from "vitest";
import type { ProjectMaterialUseSite } from "../../types";
import { buildUseSitePhotoChanges, groupMaterialUseSites } from "./use-site-groups";

const baseSite: ProjectMaterialUseSite = {
  assembly_id: "asm_wall",
  assembly_name: "WALL-C3",
  layer_id: "lyr_1",
  layer_order: 0,
  segment_id: "seg_1",
  segment_order: 0,
  use_site_notes: null,
  photo_asset_ids: [],
};

describe("groupMaterialUseSites", () => {
  test("collapses repeated segment uses to one assembly-level site group", () => {
    const groups = groupMaterialUseSites([
      {
        ...baseSite,
        segment_id: "seg_3",
        segment_order: 2,
        photo_asset_ids: ["asset_c"],
      },
      {
        ...baseSite,
        segment_id: "seg_1",
        segment_order: 0,
        photo_asset_ids: ["asset_a"],
      },
      {
        ...baseSite,
        segment_id: "seg_2",
        segment_order: 1,
        photo_asset_ids: ["asset_b"],
      },
      {
        ...baseSite,
        assembly_id: "asm_roof",
        assembly_name: "ROOF-R1",
        segment_id: "seg_4",
        photo_asset_ids: [],
      },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      key: "asm_wall",
      whereLabel: "layer 1, segments 1, 2, 3",
      canEditNotes: false,
    });
    expect(groups[0]?.site.photo_asset_ids).toEqual(["asset_a", "asset_b", "asset_c"]);
    expect(groups[0]?.sites.map((site) => site.segment_id)).toEqual(["seg_1", "seg_2", "seg_3"]);
  });

  test("builds segment-level attachment changes from an assembly-level photo edit", () => {
    const [group] = groupMaterialUseSites([
      {
        ...baseSite,
        segment_id: "seg_1",
        segment_order: 0,
        photo_asset_ids: ["asset_a"],
      },
      {
        ...baseSite,
        segment_id: "seg_2",
        segment_order: 1,
        photo_asset_ids: ["asset_b"],
      },
    ]);

    expect(buildUseSitePhotoChanges(group!, ["asset_b", "asset_c"])).toEqual([
      {
        tableKey: "assembly_segments",
        rowId: "seg_1",
        fieldKey: "photo_asset_ids",
        currentAssetIds: ["asset_a"],
        nextAssetIds: ["asset_c"],
      },
    ]);
  });
});
