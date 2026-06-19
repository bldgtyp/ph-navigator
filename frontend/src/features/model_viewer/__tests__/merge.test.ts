import { describe, expect, test } from "vitest";
import { BufferAttribute, BufferGeometry } from "three";
import { mergeEdges, mergeRenderableGeometries, type GeometryGroup } from "../loaders/merge";

/** A non-indexed triangle with position + normal, like the viewer's faces. */
function triangle(z = 0): BufferGeometry {
  const geometry = new BufferGeometry();
  const positions = new Float32Array([0, 0, z, 1, 0, z, 0, 1, z]);
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function group(...geometries: BufferGeometry[]): GeometryGroup {
  return { geometries };
}

describe("mergeRenderableGeometries", () => {
  test("merged vertex count equals the sum of inputs and ranges map back to groups", () => {
    const result = mergeRenderableGeometries([group(triangle()), group(triangle(1), triangle(2))]);

    expect(result.geometry.getAttribute("position").count).toBe(9);
    expect(result.ranges).toEqual([
      { index: 0, start: 0, count: 3 },
      { index: 1, start: 3, count: 6 },
    ]);
  });

  test("skips groups that contribute no geometry but keeps their original index", () => {
    const result = mergeRenderableGeometries([group(), group(triangle())]);

    expect(result.ranges).toEqual([{ index: 1, start: 0, count: 3 }]);
  });

  test("empty input yields an empty geometry with no ranges", () => {
    const result = mergeRenderableGeometries([]);

    expect(result.geometry.getAttribute("position")).toBeUndefined();
    expect(result.ranges).toEqual([]);
  });

  test("throws when a source geometry is missing the normal attribute", () => {
    const noNormal = new BufferGeometry();
    noNormal.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3),
    );

    expect(() => mergeRenderableGeometries([group(noNormal)])).toThrow(/normal/);
  });
});

describe("mergeEdges", () => {
  test("produces a non-empty line geometry from the source outlines", () => {
    const edges = mergeEdges([group(triangle()), group(triangle(1))], 12);

    expect(edges.getAttribute("position").count).toBeGreaterThan(0);
  });

  test("empty input yields an empty geometry", () => {
    const edges = mergeEdges([], 12);

    expect(edges.getAttribute("position")).toBeUndefined();
  });
});
