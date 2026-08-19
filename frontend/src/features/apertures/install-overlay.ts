// Pure view-model for the Installs modal key view. Composes on
// `resolveInstallPsiForAperture` — the single owner of edge resolution —
// so the paint overlay can never disagree with the FrameRow Ψ cells; this
// module only adds geometry (tint band rects), the deterministic
// type→color assignment, and the paint-click transition.

import { elementRectMm, elementRegionsMm, type RectMm } from "./aperture-geometry";
import {
  APERTURE_INSTALL_DEFAULT_TYPE_ID,
  resolveInstallPsiForAperture,
  type ResolvedInstallPsi,
} from "./install-psi";
import { classifyElementEdges, edgeClassKey } from "./edge-classification";
import {
  APERTURE_SIDES,
  type ApertureInstallTypeSummary,
  type ApertureSide,
  type ApertureTypeEntry,
} from "./types";

// Deterministic tint palette: categorical chart tokens, cycled in legend
// row order. The Default row always gets the neutral swatch.
const TINT_TOKENS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;
export const DEFAULT_TINT_TOKEN = "var(--text-muted)";

// A band normally *is* the drawn frame strip, so the tint reads as recoloring
// the frame rather than as a box floating over it. A side with no picked frame
// has a zero-thickness strip, so it falls back to this much (mm) to stay
// visible and hittable — callers pass the mm equivalent of a few screen px at
// the current zoom, capped below at a third of the element.
const DEFAULT_MIN_BAND_MM = 80;

export type InstallOverlayCell = {
  elementId: string;
  side: ApertureSide;
  rect: RectMm;
  /** Mirror of the resolved source: assigned / default (inherited) / mull. */
  kind: ResolvedInstallPsi["source"];
  resolved: ResolvedInstallPsi;
  /** The element's raw slot value (paint-toggle input; mull cells keep
   *  whatever stale slot they carry, though it never resolves). */
  rawSlot: string | null;
  /** CSS color (token reference) for the tint; null on mull cells. */
  color: string | null;
};

export type InstallOverlaySource = Omit<InstallOverlayCell, "rect"> & {
  elementRect: RectMm;
  strip: RectMm;
};

export type PerimeterInstallEdge = {
  elementId: string;
  side: ApertureSide;
  rawSlot: string | null;
};

/** Legend-order deterministic color per install type id. */
export function installTintColors(
  installTypes: readonly ApertureInstallTypeSummary[],
): Map<string, string> {
  const colors = new Map<string, string>();
  let paletteIndex = 0;
  for (const installType of installTypes) {
    if (installType.id === APERTURE_INSTALL_DEFAULT_TYPE_ID) {
      colors.set(installType.id, DEFAULT_TINT_TOKEN);
      continue;
    }
    colors.set(installType.id, TINT_TOKENS[paletteIndex % TINT_TOKENS.length]!);
    paletteIndex += 1;
  }
  return colors;
}

/** One tint/hit cell per side of every glazed element. `minBandMm` is the
 *  fallback thickness for a side with no picked frame (see
 *  `DEFAULT_MIN_BAND_MM`). */
export function installOverlayModel(
  aperture: ApertureTypeEntry,
  installTypes: readonly ApertureInstallTypeSummary[],
  minBandMm: number = DEFAULT_MIN_BAND_MM,
): InstallOverlayCell[] {
  return installOverlayBands(installOverlaySources(aperture, installTypes), minBandMm);
}

/** Resolve scale-independent edge semantics once; resizing only rebuilds band rectangles. */
export function installOverlaySources(
  aperture: ApertureTypeEntry,
  installTypes: readonly ApertureInstallTypeSummary[],
): InstallOverlaySource[] {
  const resolution = resolveInstallPsiForAperture(aperture, installTypes);
  const colors = installTintColors(installTypes);
  const cells: InstallOverlaySource[] = [];
  for (const element of aperture.elements) {
    if (element.kind !== "glazed") continue;
    const rect = elementRectMm(aperture, element);
    const regions = elementRegionsMm(element, rect);
    for (const side of APERTURE_SIDES) {
      const resolved = resolution.get(edgeClassKey(element.id, side));
      if (!resolved) continue;
      cells.push({
        elementId: element.id,
        side,
        elementRect: rect,
        strip: regions[side],
        kind: resolved.source,
        resolved,
        rawSlot: element.installs[side],
        color:
          resolved.source === "mull"
            ? null
            : resolved.source === "assigned"
              ? (colors.get(resolved.installTypeId ?? "") ?? DEFAULT_TINT_TOKEN)
              : DEFAULT_TINT_TOKEN,
      });
    }
  }
  return cells;
}

/** Apply the zoom-dependent fallback band thickness to resolved overlay sources. */
export function installOverlayBands(
  sources: readonly InstallOverlaySource[],
  minBandMm: number = DEFAULT_MIN_BAND_MM,
): InstallOverlayCell[] {
  return sources.map(({ elementRect, strip, ...cell }) => ({
    ...cell,
    rect: bandRect(cell.side, elementRect, strip, minBandMm),
  }));
}

/** Glazed perimeter edges that can receive an explicit install assignment. */
export function perimeterInstallEdges(aperture: ApertureTypeEntry): PerimeterInstallEdge[] {
  const classes = classifyElementEdges(aperture);
  const edges: PerimeterInstallEdge[] = [];
  for (const element of aperture.elements) {
    if (element.kind !== "glazed") continue;
    for (const side of APERTURE_SIDES) {
      if (classes.get(edgeClassKey(element.id, side)) === "interior") continue;
      edges.push({ elementId: element.id, side, rawSlot: element.installs[side] });
    }
  }
  return edges;
}

/** Paint-click transition: assign the armed type, or clear back to
 *  inherit when the edge already carries it. `undefined` = no-op. */
export function nextInstallForClick(
  currentSlot: string | null,
  armedTypeId: string | null,
): string | null | undefined {
  if (armedTypeId === null) return undefined;
  return currentSlot === armedTypeId ? null : armedTypeId;
}

/**
 * Position-and-kind grid fingerprint — mirror of the backend
 * `_grid_signature` (handlers/installs.py): dimension counts + sorted
 * element spans/kinds, mm dimensions free to differ. Copy-to candidates
 * must match exactly (the backend 422s otherwise). Follow-up candidate:
 * emit this from the backend on the apertures slice so the predicate has
 * one owner.
 */
export function apertureGridSignature(aperture: ApertureTypeEntry): string {
  const cells = aperture.elements
    .map(
      (element) =>
        `${element.row_span[0]},${element.row_span[1]},${element.column_span[0]},${element.column_span[1]},${
          element.kind === "glazed" ? 1 : 0
        }`,
    )
    .sort();
  return `${aperture.row_heights_mm.length}x${aperture.column_widths_mm.length}|${cells.join(";")}`;
}

/** Per-type live usage count across every glazed element of the project.
 *  Counts what each perimeter edge actually *uses*: an edge with no explicit
 *  slot uses the Default row, so it counts there — Default is an ordinary
 *  library row, not an absence. Mulled (interior) edges carry no assignment
 *  and are skipped, stale slot or not. */
export function installUsageCounts(apertures: readonly ApertureTypeEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const aperture of apertures) {
    for (const edge of perimeterInstallEdges(aperture)) {
      const slot = edge.rawSlot ?? APERTURE_INSTALL_DEFAULT_TYPE_ID;
      counts.set(slot, (counts.get(slot) ?? 0) + 1);
    }
  }
  return counts;
}

/** The drawn frame strip itself, thickened only when the side carries no
 *  frame. Everything but the thickness comes from `strip`, so the band keeps
 *  the SVG's corner ownership (top/bottom span the full element width; left/
 *  right are inset between them) and lands exactly on the rendered frame. */
function bandRect(
  side: ApertureSide,
  elementRect: RectMm,
  strip: RectMm,
  minBandMm: number,
): RectMm {
  if (side === "top" || side === "bottom") {
    if (strip.height >= minBandMm) return strip;
    const height = Math.min(minBandMm, elementRect.height / 3);
    return side === "top"
      ? { ...strip, height }
      : { ...strip, y: elementRect.y + elementRect.height - height, height };
  }
  if (strip.width >= minBandMm) return strip;
  const width = Math.min(minBandMm, elementRect.width / 3);
  return side === "left"
    ? { ...strip, width }
    : { ...strip, x: elementRect.x + elementRect.width - width, width };
}
