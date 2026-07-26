import { MEMBRANE_MIN_HIT_HEIGHT_PX, pxFromMm } from "./canvas-constants";

export type CanvasHitBox = { topPx: number; heightPx: number };

type HitBoxInput = {
  yMm: number;
  heightMm: number;
  isMembrane: boolean;
  hitRoomAboveMm: number;
  hitRoomBelowMm: number;
};

/**
 * Where a layer's clickable box sits, in pixels.
 *
 * For an ordinary layer this is just the drawn band. A membrane's band is only
 * a few pixels tall at every zoom the app offers (4 mm × 0.5–3), which is fine
 * to look at and impossible to click — a neighbouring 140 mm layer wins the hit
 * test every time. So the box grows to `MEMBRANE_MIN_HIT_HEIGHT_PX`, centred on
 * the band, and the membrane overlay is raised a stacking step so it wins
 * across the overhang.
 *
 * The expansion is capped per side by the room the geometry says is available
 * (`hitRoomAbove/BelowMm`). That matters when two membranes are adjacent — a
 * realistic assembly, e.g. a separate air barrier stacked against a WRB. Each
 * would otherwise expand into the other's band, they would tie on `z-index`,
 * and paint order alone would decide which one a click selected. Capping at
 * half the neighbour's band makes the two boxes meet exactly at the shared
 * edge instead.
 *
 * A capped box is smaller than the minimum. That is the honest outcome: the
 * space genuinely is not there, and a slightly small target beats one that
 * silently steals its neighbour's clicks.
 */
export function canvasHitBox(input: HitBoxInput, zoom: number): CanvasHitBox {
  const topPx = pxFromMm(input.yMm, zoom);
  const heightPx = pxFromMm(input.heightMm, zoom);
  if (!input.isMembrane || heightPx >= MEMBRANE_MIN_HIT_HEIGHT_PX) {
    return { topPx, heightPx };
  }

  const wantedPerSide = (MEMBRANE_MIN_HIT_HEIGHT_PX - heightPx) / 2;
  const abovePx = Math.min(wantedPerSide, pxFromMm(input.hitRoomAboveMm, zoom));
  const belowPx = Math.min(wantedPerSide, pxFromMm(input.hitRoomBelowMm, zoom));
  return { topPx: topPx - abovePx, heightPx: heightPx + abovePx + belowPx };
}
