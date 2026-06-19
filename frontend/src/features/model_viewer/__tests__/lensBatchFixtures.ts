import { BufferAttribute, BufferGeometry } from "three";
import type { BuildingRenderable } from "../loaders/building";
import type { ModelObjectMeta, ModelObjectType } from "../types";

/** Shared synthetic geometry/renderable fixtures for the LensBatch tests. */

export function triangle(z = 0): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array([0, 0, z, 1, 0, z, 0, 1, z]), 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

/** A minimal `BuildingRenderable` with `geometryCount` distinct triangles.
 *  `buildLensBatch` only reads `meta.type`, so a partial meta is enough. */
export function renderable(
  id: string,
  type: ModelObjectType,
  geometryCount = 1,
): BuildingRenderable {
  return {
    id,
    lens: "building",
    kind: "mesh",
    geometries: Array.from({ length: geometryCount }, (_, index) => triangle(index)),
    meta: { id, type } as unknown as ModelObjectMeta,
  };
}

/** `count` single-triangle renderables of one type (for the perf-gate scaling tests). */
export function manyFaces(count: number, type: ModelObjectType): BuildingRenderable[] {
  return Array.from({ length: count }, (_, index) => renderable(`${type}:${index}`, type));
}
