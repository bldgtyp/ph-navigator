import type { ModelRenderable } from "../loaders/building";
import type { LegendFilter, ModelObjectMeta, ModelViewerLens, ModelViewerTheme } from "../types";
import { colorForThemedObject } from "./themes";

/**
 * The legend-as-filter predicate (NEW-VIEW-2). The legend already groups objects
 * by a per-bucket key (`colorForThemedObject(...).key` for themed rows, the line
 * style for mini-key rows); the filter is the inversion of that grouping —
 * an object is hidden iff its bucket key is not in the active set. This module is
 * the single source of truth shared by the legend rows, the batched-mesh
 * visibility gate (`BatchedLens`), the per-object line gate (`BuildingLens`), and
 * the debug hook.
 */

/** The legend bucket an object belongs to under the active lens/theme: its line
 *  style for line lenses, otherwise its color-by-theme key. `null` when the theme
 *  does not classify the object (e.g. an aperture under the Boundary theme). */
export function bucketKeyForObject(
  object: ModelRenderable,
  lens: ModelViewerLens,
  theme: ModelViewerTheme,
): string | null {
  if (object.kind === "line") return object.lineStyle;
  return bucketKeyForMeta(object.meta, lens, theme);
}

/** Bucket key from object meta alone. The batched substrate holds meta (not the
 *  whole renderable) per instance, and every batched object is a mesh. */
export function bucketKeyForMeta(
  meta: ModelObjectMeta,
  lens: ModelViewerLens,
  theme: ModelViewerTheme,
): string | null {
  return colorForThemedObject(meta, lens, theme)?.key ?? null;
}

/**
 * Whether a bucket key is hidden under `filter`. Nothing is hidden without a
 * filter or when the filter's stamped theme is stale (a guard against a filter
 * outliving the theme it was built for). Otherwise an object is hidden unless its
 * (non-null) bucket key is in the active set — so an object the theme does not
 * classify (`null` key) is hidden while a filter is active, isolating exactly the
 * matched bucket.
 */
export function isBucketHidden(
  bucketKey: string | null,
  theme: ModelViewerTheme,
  filter: LegendFilter | null,
): boolean {
  if (!filter || filter.theme !== theme) return false;
  return bucketKey === null || !filter.keys.has(bucketKey);
}

export function isHiddenByFilter(
  object: ModelRenderable,
  lens: ModelViewerLens,
  theme: ModelViewerTheme,
  filter: LegendFilter | null,
): boolean {
  return isBucketHidden(bucketKeyForObject(object, lens, theme), theme, filter);
}
