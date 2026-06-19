import { describe, expect, test } from "vitest";
import { LineSegments } from "three";
import { buildLensBatch } from "../scene/LensBatch";
import { manyFaces } from "./lensBatchFixtures";

/**
 * The Phase-05 perf-regression gate (A5 / G5). The whole point of the D-1
 * BatchedMesh substrate is that a lens draws in a constant number of GPU objects
 * — at most one opaque + one transparent `BatchedMesh` plus one merged edge line
 * — no matter how many source faces it holds. The original review's lag was
 * O(faces) draw calls (Hillandale: 14,415 @ 1.1 FPS); these assertions fail loudly
 * if a refactor ever reintroduces per-object meshes, which a raw FPS check would
 * miss. It's a structural proxy for draw calls, so it needs no GPU and runs in
 * the normal Vitest suite (and therefore `make ci`).
 *
 * Threshold rationale: a lens's scene draw objects = `batch.meshes.length` (≤ 2)
 * + 1 edge `LineSegments` = ≤ 3, measured steady-state on Hillandale at 14 total
 * scene draw calls @ 60 FPS (the rest is grid/shadows/post). The gate asserts the
 * per-lens contribution stays O(1).
 */

const MAX_BATCHED_MESHES_PER_LENS = 2; // one opaque + one transparent

describe("perf gate: a lens is O(1) draw objects, not O(faces)", () => {
  test("thousands of faces + apertures collapse to ≤ 2 batched meshes + 1 edge line", () => {
    const batch = buildLensBatch([
      ...manyFaces(3000, "faceMesh"),
      ...manyFaces(1500, "apertureMeshFace"),
    ]);

    expect(batch.meshes.length).toBeLessThanOrEqual(MAX_BATCHED_MESHES_PER_LENS);
    expect(batch.edges).toBeInstanceOf(LineSegments);
    // 4,500 source objects still map back through one batch each (no per-object mesh).
    expect(batch.batchForId.size).toBe(4500);
    batch.dispose();
  });

  test("draw-object count does not grow with object count", () => {
    const small = buildLensBatch(manyFaces(10, "faceMesh"));
    const large = buildLensBatch(manyFaces(5000, "faceMesh"));

    // O(1): a 500× larger lens draws in the same number of GPU objects.
    expect(large.meshes.length).toBe(small.meshes.length);
    expect(large.meshes.length).toBeLessThanOrEqual(MAX_BATCHED_MESHES_PER_LENS);
    small.dispose();
    large.dispose();
  });
});
