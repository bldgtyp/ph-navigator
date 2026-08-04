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
import { edgeClassKey } from "./edge-classification";
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

// A frame side with no picked frame has a zero-thickness strip; keep every
// paintable edge at least this thick (mm) so the band stays visible/hittable.
const MIN_BAND_MM = 80;

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

/** One tint/hit cell per side of every glazed element. */
export function installOverlayModel(
  aperture: ApertureTypeEntry,
  installTypes: readonly ApertureInstallTypeSummary[],
): InstallOverlayCell[] {
  const resolution = resolveInstallPsiForAperture(aperture, installTypes);
  const colors = installTintColors(installTypes);
  const cells: InstallOverlayCell[] = [];
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
        rect: bandRect(side, rect, regions[side]),
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

/** Per-type live usage count across every glazed element of the project. */
export function installUsageCounts(apertures: readonly ApertureTypeEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const aperture of apertures) {
    for (const element of aperture.elements) {
      if (element.kind !== "glazed") continue;
      for (const side of APERTURE_SIDES) {
        const slot = element.installs[side];
        if (slot !== null) counts.set(slot, (counts.get(slot) ?? 0) + 1);
      }
    }
  }
  return counts;
}

function bandRect(side: ApertureSide, elementRect: RectMm, strip: RectMm): RectMm {
  if (side === "top" || side === "bottom") {
    const height = Math.max(strip.height, Math.min(MIN_BAND_MM, elementRect.height / 3));
    return side === "top"
      ? { x: elementRect.x, y: elementRect.y, width: elementRect.width, height }
      : {
          x: elementRect.x,
          y: elementRect.y + elementRect.height - height,
          width: elementRect.width,
          height,
        };
  }
  const width = Math.max(strip.width, Math.min(MIN_BAND_MM, elementRect.width / 3));
  return side === "left"
    ? { x: elementRect.x, y: elementRect.y, width, height: elementRect.height }
    : {
        x: elementRect.x + elementRect.width - width,
        y: elementRect.y,
        width,
        height: elementRect.height,
      };
}
