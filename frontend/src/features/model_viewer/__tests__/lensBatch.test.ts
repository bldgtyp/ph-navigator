import { describe, expect, test } from "vitest";
import { BatchedMesh } from "three";
import { viewerBaseColor, type ViewerTokens } from "../lib/colors";
import { buildLensBatch, resolveInstanceColor } from "../scene/LensBatch";
import type { ModelObjectMeta } from "../types";
import { renderable } from "./lensBatchFixtures";

const TOKENS: ViewerTokens = { highlight: "#E23489", highlightSoft: "#f0a8cb" };

describe("buildLensBatch", () => {
  test("splits opaque faces from transparent apertures into separate batches", () => {
    const batch = buildLensBatch([
      renderable("face:a", "faceMesh"),
      renderable("face:b", "faceMesh"),
      renderable("aperture:c", "apertureMeshFace"),
    ]);

    expect(batch.opaqueMesh).toBeInstanceOf(BatchedMesh);
    expect(batch.transparentMesh).toBeInstanceOf(BatchedMesh);
    expect(batch.meshes).toHaveLength(2);
    batch.dispose();
  });

  test("idForBatch and batchForId round-trip every object", () => {
    const ids = ["face:a", "face:b", "aperture:c"];
    const batch = buildLensBatch([
      renderable("face:a", "faceMesh"),
      renderable("face:b", "faceMesh"),
      renderable("aperture:c", "apertureMeshFace"),
    ]);

    expect(batch.batchForId.size).toBe(3);
    for (const id of ids) {
      const locations = batch.batchForId.get(id);
      expect(locations).toHaveLength(1);
      // every instance's id map points back at the same object id
      for (const location of locations!) {
        expect(batch.idForBatch.get(location.mesh)?.get(location.instanceId)).toBe(id);
      }
    }
    batch.dispose();
  });

  test("a multi-geometry object records one batch location per geometry", () => {
    const batch = buildLensBatch([renderable("space:a", "spaceGroup", 3)]);

    const locations = batch.batchForId.get("space:a");
    expect(locations).toHaveLength(3);
    // all three instances round-trip to the same object id (full-object highlight)
    for (const location of locations!) {
      expect(batch.idForBatch.get(location.mesh)?.get(location.instanceId)).toBe("space:a");
    }
    batch.dispose();
  });

  test("an all-opaque lens has no transparent batch", () => {
    const batch = buildLensBatch([renderable("face:a", "faceMesh")]);

    expect(batch.opaqueMesh).toBeInstanceOf(BatchedMesh);
    expect(batch.transparentMesh).toBeNull();
    expect(batch.meshes).toHaveLength(1);
    batch.dispose();
  });

  test("empty input yields no batches but a (degenerate) edge line", () => {
    const batch = buildLensBatch([]);

    expect(batch.opaqueMesh).toBeNull();
    expect(batch.transparentMesh).toBeNull();
    expect(batch.meshes).toHaveLength(0);
    expect(batch.batchForId.size).toBe(0);
    batch.dispose();
  });
});

describe("resolveInstanceColor", () => {
  const faceMeta = { id: "face:a", type: "faceMesh" } as unknown as ModelObjectMeta;
  const wallMeta = {
    id: "face:wall",
    type: "faceMesh",
    face_type: "Wall",
  } as unknown as ModelObjectMeta;

  test("selection/hover take the highlight tokens regardless of theme", () => {
    expect(resolveInstanceColor(wallMeta, "building", "surface-type", "selected", TOKENS)).toBe(
      TOKENS.highlight,
    );
    expect(resolveInstanceColor(wallMeta, "building", "surface-type", "hovered", TOKENS)).toBe(
      TOKENS.highlightSoft,
    );
  });

  test("base state under shaded theme is the per-type base color", () => {
    expect(resolveInstanceColor(faceMeta, "building", "shaded", "base", TOKENS)).toBe(
      viewerBaseColor("faceMesh"),
    );
  });

  test("base state under a color-by theme uses the themed color", () => {
    // Surface Type colors a Wall face with the FACE_TYPE_COLORS Wall hue.
    expect(resolveInstanceColor(wallMeta, "building", "surface-type", "base", TOKENS)).toBe(
      "#E6B43C",
    );
  });
});
