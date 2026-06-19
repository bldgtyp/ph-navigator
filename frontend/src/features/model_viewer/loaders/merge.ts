import { BufferGeometry, EdgesGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * The merge helpers collapse many small per-object `BufferGeometry` instances
 * into a single geometry so a whole group of objects draws in one call instead
 * of thousands (the F5 ghost here, and the Phase 03/04 batched lenses later).
 *
 * They are deliberately pure and substrate-agnostic: they take anything with a
 * `geometries` array, never read `id`/`meta`, and never mutate or dispose their
 * inputs (the source geometries stay owned by the model). The interactive
 * lenses reuse `MergedRange` to map a merged vertex span back to its source
 * object for picking, so the same primitive serves Phase 03 batching.
 */

/** Any renderable that contributes one or more geometries to a merge. */
export type GeometryGroup = { geometries: BufferGeometry[] };

/** Where a single source group landed in the merged position buffer. */
export type MergedRange = {
  /** Index of the source group in the input array. */
  index: number;
  /** First vertex contributed by this group. */
  start: number;
  /** Number of vertices this group contributed. */
  count: number;
};

export type MergedGeometry = {
  geometry: BufferGeometry;
  ranges: MergedRange[];
};

// Source face geometries carry position + normal and are non-indexed (see
// `geometry.ts`); `mergeGeometries` requires a uniform layout, so guard early
// with a clear error instead of letting the merge silently return null.
const REQUIRED_ATTRIBUTES = ["position", "normal"] as const;

/**
 * Merge each group's geometries into one buffer, returning the merged geometry
 * plus the per-group vertex ranges (for batched picking later). Empty input
 * yields an empty geometry with no ranges.
 */
export function mergeRenderableGeometries(groups: GeometryGroup[]): MergedGeometry {
  const geometries: BufferGeometry[] = [];
  const ranges: MergedRange[] = [];
  let cursor = 0;

  groups.forEach((group, index) => {
    let count = 0;
    for (const geometry of group.geometries) {
      assertMergeable(geometry);
      geometries.push(geometry);
      count += geometry.getAttribute("position").count;
    }
    if (count > 0) {
      ranges.push({ index, start: cursor, count });
      cursor += count;
    }
  });

  return { geometry: mergeOrEmpty(geometries), ranges };
}

/**
 * Build each group geometry's `EdgesGeometry` (silhouette/crease lines above
 * `thresholdDegrees`) and merge them into one `LineSegments` geometry. The
 * intermediate edge geometries are scratch — their data is copied into the
 * merged buffer, so they are disposed before returning.
 */
export function mergeEdges(groups: GeometryGroup[], thresholdDegrees: number): BufferGeometry {
  const edges: BufferGeometry[] = [];
  for (const group of groups) {
    for (const geometry of group.geometries) {
      const edge = new EdgesGeometry(geometry, thresholdDegrees);
      if (edge.getAttribute("position").count > 0) {
        edges.push(edge);
      } else {
        edge.dispose();
      }
    }
  }

  const merged = mergeOrEmpty(edges);
  for (const edge of edges) edge.dispose();
  return merged;
}

function mergeOrEmpty(geometries: BufferGeometry[]): BufferGeometry {
  if (geometries.length === 0) return new BufferGeometry();
  const merged = mergeGeometries(geometries, false);
  if (!merged) {
    throw new Error("Geometry merge failed: source geometries have incompatible attributes.");
  }
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function assertMergeable(geometry: BufferGeometry): void {
  if (geometry.index) {
    throw new Error("Geometry merge expects non-indexed geometry.");
  }
  for (const name of REQUIRED_ATTRIBUTES) {
    if (!geometry.getAttribute(name)) {
      throw new Error(`Geometry merge expects a "${name}" attribute on every source geometry.`);
    }
  }
}
